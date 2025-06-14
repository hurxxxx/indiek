import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const page = parseInt(searchParams.get('page') || '1');
    const limit = parseInt(searchParams.get('limit') || '10');
    const published = searchParams.get('published') === 'true';

    const skip = (page - 1) * limit;

    const where = published ? { isPublished: true } : {};

    const [posts, total] = await Promise.all([
      prisma.post.findMany({
        where,
        include: {
          author: {
            select: { id: true, name: true, username: true }
          },
          artist: {
            select: { id: true, name: true, slug: true }
          },
          tags: {
            include: { tag: true }
          },
          _count: {
            select: { comments: true, likes: true }
          }
        },
        orderBy: { createdAt: 'desc' },
        skip,
        take: limit,
      }),
      prisma.post.count({ where })
    ]);

    return NextResponse.json({
      posts,
      pagination: {
        page,
        limit,
        total,
        pages: Math.ceil(total / limit)
      }
    });
  } catch (error) {
    console.error('Error fetching posts:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    
    if (!session?.user?.id) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    const { title, content, excerpt, artistId, selectedTags, isPublished } = await request.json();

    if (!title || !content) {
      return NextResponse.json(
        { error: 'Title and content are required' },
        { status: 400 }
      );
    }

    // Generate slug from title
    const slug = title
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/(^-|-$)/g, '');

    // Check if slug already exists
    const existingPost = await prisma.post.findUnique({
      where: { slug }
    });

    const finalSlug = existingPost ? `${slug}-${Date.now()}` : slug;

    const post = await prisma.post.create({
      data: {
        title,
        slug: finalSlug,
        content,
        excerpt,
        authorId: session.user.id,
        artistId: artistId || null,
        isPublished,
        publishedAt: isPublished ? new Date() : null,
        tags: {
          create: selectedTags?.map((tagId: string) => ({
            tag: { connect: { id: tagId } }
          })) || []
        }
      },
      include: {
        author: {
          select: { id: true, name: true, username: true }
        },
        artist: {
          select: { id: true, name: true, slug: true }
        },
        tags: {
          include: { tag: true }
        }
      }
    });

    return NextResponse.json(post, { status: 201 });
  } catch (error) {
    console.error('Error creating post:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
