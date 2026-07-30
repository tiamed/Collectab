import { Hono } from 'hono';
import { zValidator } from '@hono/zod-validator';
import { z } from 'zod';
import { getDb } from '../../database/client.js';
import { spaces, collections, bookmarks } from '../../database/schema.js';
import { authMiddleware, type AuthEnv } from '../middleware/auth.js';

const niceTabSchema = z.array(
  z.object({
    tagName: z.string(),
    createTime: z.string().optional(),
    groupList: z.array(
      z.object({
        groupName: z.string(),
        createTime: z.string().optional(),
        isStarred: z.boolean().optional(),
        tabList: z.array(
          z.object({
            title: z.string(),
            url: z.string(),
          }),
        ),
      }),
    ),
    static: z.boolean().optional(),
  }),
);

const tobySchema = z.object({
  version: z.number().optional(),
  groups: z.array(
    z.object({
      name: z.string(),
      type: z.string().optional(),
      lists: z.array(
        z.object({
          title: z.string(),
          cards: z.array(
            z.object({
              title: z.string(),
              url: z.string(),
              favIconUrl: z.string().optional(),
              customTitle: z.string().optional(),
              customDescription: z.string().optional(),
              description: z.string().optional(),
            }),
          ),
          labelIds: z.array(z.string()).optional(),
        }),
      ),
    }),
  ),
});

const nativeSchema = z.object({
  version: z.number(),
  exportedAt: z.string().optional(),
  spaces: z.array(
    z.object({
      name: z.string(),
      icon: z.string().optional().default('📁'),
      orderIndex: z.number().optional().default(0),
      collections: z.array(
        z.object({
          name: z.string(),
          icon: z.string().optional().default('📁'),
          color: z.string().optional().default('#3b82f6'),
          orderIndex: z.number().optional().default(0),
          bookmarks: z.array(
            z.object({
              title: z.string(),
              url: z.string(),
              description: z.string().nullable().optional(),
              favicon: z.string().nullable().optional(),
              tags: z.array(z.string()).optional().default([]),
              orderIndex: z.number().optional().default(0),
            }),
          ),
        }),
      ),
    }),
  ),
});

const importSchema = z.object({
  format: z.enum(['nicetab', 'toby', 'native']),
  data: z.unknown(),
  orgId: z.string().uuid().optional(),
});

export const importRoutes = new Hono<AuthEnv>();
importRoutes.use('*', authMiddleware);

importRoutes.post('/', zValidator('json', importSchema), async (c) => {
  const db = getDb();
  const userId = c.get('userId');
  const { format, data, orgId } = c.req.valid('json');

  if (format === 'nicetab') {
    const parsed = niceTabSchema.safeParse(data);
    if (!parsed.success) {
      return c.json({ error: 'Invalid NiceTab format', details: parsed.error.issues }, 400);
    }

    const tags = parsed.data;
    let spacesCreated = 0;
    let collectionsCreated = 0;
    let bookmarksCreated = 0;

    for (let si = 0; si < tags.length; si++) {
      const tag = tags[si];
      if (tag.groupList.length === 0) continue;

      const [space] = await db
        .insert(spaces)
        .values({
          ownerId: userId,
          name: tag.tagName,
          icon: '📁',
          orderIndex: si,
          orgId: orgId || null,
        })
        .returning();
      spacesCreated++;

      for (let ci = 0; ci < tag.groupList.length; ci++) {
        const group = tag.groupList[ci];
        if (group.tabList.length === 0) continue;

        const [collection] = await db
          .insert(collections)
          .values({
            spaceId: space.id,
            ownerId: userId,
            name: group.groupName,
            icon: '📁',
            color: '#3b82f6',
            orderIndex: ci,
          })
          .returning();
        collectionsCreated++;

        const bookmarkValues = group.tabList.map((tab, bi) => ({
          collectionId: collection.id,
          title: tab.title.substring(0, 500),
          url: tab.url,
          description: null,
          favicon: getFavicon(tab.url),
          tags: [] as string[],
          orderIndex: bi,
        }));

        if (bookmarkValues.length > 0) {
          await db.insert(bookmarks).values(bookmarkValues);
          bookmarksCreated += bookmarkValues.length;
        }
      }
    }

    return c.json({
      message: 'Import successful',
      stats: { spacesCreated, collectionsCreated, bookmarksCreated },
    });
  }

  if (format === 'toby') {
    const parsed = tobySchema.safeParse(data);
    if (!parsed.success) {
      return c.json({ error: 'Invalid Toby format', details: parsed.error.issues }, 400);
    }

    const { groups } = parsed.data;
    let spacesCreated = 0;
    let collectionsCreated = 0;
    let bookmarksCreated = 0;

    for (let si = 0; si < groups.length; si++) {
      const group = groups[si];
      if (group.lists.length === 0) continue;

      const [space] = await db
        .insert(spaces)
        .values({
          ownerId: userId,
          name: group.name,
          icon: '📁',
          orderIndex: si,
          orgId: orgId || null,
        })
        .returning();
      spacesCreated++;

      for (let ci = 0; ci < group.lists.length; ci++) {
        const list = group.lists[ci];
        if (list.cards.length === 0) continue;

        const [collection] = await db
          .insert(collections)
          .values({
            spaceId: space.id,
            ownerId: userId,
            name: list.title,
            icon: '📁',
            color: '#3b82f6',
            orderIndex: ci,
          })
          .returning();
        collectionsCreated++;

        const bookmarkValues = list.cards.map((card, bi) => ({
          collectionId: collection.id,
          title: (card.customTitle || card.title).substring(0, 500),
          url: card.url,
          description: (card.customDescription || card.description || null) as string | null,
          favicon: card.favIconUrl || getFavicon(card.url),
          tags: [] as string[],
          orderIndex: bi,
        }));

        if (bookmarkValues.length > 0) {
          await db.insert(bookmarks).values(bookmarkValues);
          bookmarksCreated += bookmarkValues.length;
        }
      }
    }

    return c.json({
      message: 'Import successful',
      stats: { spacesCreated, collectionsCreated, bookmarksCreated },
    });
  }

  if (format === 'native') {
    const parsed = nativeSchema.safeParse(data);
    if (!parsed.success) {
      return c.json({ error: 'Invalid native export format', details: parsed.error.issues }, 400);
    }

    const { spaces: exportedSpaces } = parsed.data;
    let spacesCreated = 0;
    let collectionsCreated = 0;
    let bookmarksCreated = 0;

    for (let si = 0; si < exportedSpaces.length; si++) {
      const exportedSpace = exportedSpaces[si];

      const [space] = await db
        .insert(spaces)
        .values({
          ownerId: userId,
          name: exportedSpace.name,
          icon: exportedSpace.icon,
          orderIndex: exportedSpace.orderIndex ?? si,
          orgId: orgId || null,
        })
        .returning();
      spacesCreated++;

      for (let ci = 0; ci < exportedSpace.collections.length; ci++) {
        const exportedCol = exportedSpace.collections[ci];

        const [collection] = await db
          .insert(collections)
          .values({
            spaceId: space.id,
            ownerId: userId,
            name: exportedCol.name,
            icon: exportedCol.icon,
            color: exportedCol.color,
            orderIndex: exportedCol.orderIndex ?? ci,
          })
          .returning();
        collectionsCreated++;

        const bookmarkValues = exportedCol.bookmarks.map((bk, bi) => ({
          collectionId: collection.id,
          title: bk.title.substring(0, 500),
          url: bk.url,
          description: bk.description || null,
          favicon: bk.favicon || getFavicon(bk.url),
          tags: bk.tags || [],
          orderIndex: bk.orderIndex ?? bi,
        }));

        if (bookmarkValues.length > 0) {
          await db.insert(bookmarks).values(bookmarkValues);
          bookmarksCreated += bookmarkValues.length;
        }
      }
    }

    return c.json({
      message: 'Import successful',
      stats: { spacesCreated, collectionsCreated, bookmarksCreated },
    });
  }

  return c.json({ error: `Unsupported format: ${format}` }, 400);
});

function getFavicon(url: string): string {
  try {
    const hostname = new URL(url).hostname;
    return `https://icons.duckduckgo.com/ip3/${hostname}.ico`;
  } catch {
    return '';
  }
}
