import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';

export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    
    if (!session?.user?.id) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    const { postId, songId } = await request.json();

    if (!postId && !songId) {
      return NextResponse.json(
        { error: 'Either postId or songId is required' },
        { status: 400 }
      );
    }

    if (postId && songId) {
      return NextResponse.json(
        { error: 'Cannot like both post and song simultaneously' },
        { status: 400 }
      );
    }

    // Check if like already exists
    const existingLike = await prisma.like.findFirst({
      where: {
        userId: session.user.id,
        ...(postId ? { postId } : { songId })
      }
    });

    if (existingLike) {
      // Unlike - remove the like
      await prisma.like.delete({
        where: { id: existingLike.id }
      });

      return NextResponse.json({ liked: false });
    } else {
      // Like - create new like
      await prisma.like.create({
        data: {
          userId: session.user.id,
          postId: postId || null,
          songId: songId || null,
        }
      });

      return NextResponse.json({ liked: true });
    }
  } catch (error) {
    console.error('Error toggling like:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
