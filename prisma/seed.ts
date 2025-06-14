import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

async function main() {
  console.log('🌱 Starting database seeding...')

  // Create sample artists
  const iu = await prisma.artist.upsert({
    where: { slug: 'iu' },
    update: {},
    create: {
      name: 'IU',
      slug: 'iu',
      bio: 'Lee Ji-eun, known professionally as IU, is a South Korean singer-songwriter and actress. She is one of the most successful solo artists in South Korea.',
      website: 'https://www.iu-official.com',
      instagram: 'https://www.instagram.com/dlwlrma',
      youtube: 'https://www.youtube.com/channel/UC3SyT4_WLHzN7JmHQwKQZww',
      spotify: 'https://open.spotify.com/artist/3HqSLMAZ3g3d5poNaI7GOU',
    },
  })

  const dean = await prisma.artist.upsert({
    where: { slug: 'dean' },
    update: {},
    create: {
      name: 'Dean',
      slug: 'dean',
      bio: 'Kwon Hyuk, known professionally as Dean, is a South Korean alternative R&B singer-songwriter, rapper and record producer.',
      instagram: 'https://www.instagram.com/deantrbl',
      youtube: 'https://www.youtube.com/channel/UCQGgKmB8wWvjqQqyKVcMwww',
      spotify: 'https://open.spotify.com/artist/3eCd0TZrBPm2n7OIqn5zKw',
    },
  })

  const heize = await prisma.artist.upsert({
    where: { slug: 'heize' },
    update: {},
    create: {
      name: 'Heize',
      slug: 'heize',
      bio: 'Jang Da-hye, known professionally as Heize, is a South Korean singer, songwriter, and rapper.',
      instagram: 'https://www.instagram.com/heize_official',
      youtube: 'https://www.youtube.com/channel/UCQGgKmB8wWvjqQqyKVcMwww',
      spotify: 'https://open.spotify.com/artist/5dCvNgE4gBqlzy9YC6Hg6x',
    },
  })

  // Create sample songs
  await prisma.song.upsert({
    where: { slug: 'through-the-night' },
    update: {},
    create: {
      title: 'Through the Night',
      slug: 'through-the-night',
      description: 'A beautiful ballad by IU that showcases her emotional vocal range.',
      youtubeUrl: 'https://www.youtube.com/watch?v=BzYnNdJhZQw',
      duration: '3:42',
      releaseDate: new Date('2017-03-24'),
      artistId: iu.id,
    },
  })

  await prisma.song.upsert({
    where: { slug: 'instagram' },
    update: {},
    create: {
      title: 'Instagram',
      slug: 'instagram',
      description: 'A smooth R&B track by Dean featuring Syd.',
      youtubeUrl: 'https://www.youtube.com/watch?v=wKyMIrBClYw',
      duration: '3:26',
      releaseDate: new Date('2017-02-28'),
      artistId: dean.id,
    },
  })

  await prisma.song.upsert({
    where: { slug: 'star' },
    update: {},
    create: {
      title: 'Star',
      slug: 'star',
      description: 'A dreamy track by Heize with beautiful vocals.',
      youtubeUrl: 'https://www.youtube.com/watch?v=XUR8QByF2As',
      duration: '4:12',
      releaseDate: new Date('2019-07-04'),
      artistId: heize.id,
    },
  })

  // Create sample tags
  const indieTag = await prisma.tag.upsert({
    where: { slug: 'indie' },
    update: {},
    create: {
      name: 'Indie',
      slug: 'indie',
      color: '#3B82F6',
    },
  })

  const rnbTag = await prisma.tag.upsert({
    where: { slug: 'rnb' },
    update: {},
    create: {
      name: 'R&B',
      slug: 'rnb',
      color: '#8B5CF6',
    },
  })

  const balladTag = await prisma.tag.upsert({
    where: { slug: 'ballad' },
    update: {},
    create: {
      name: 'Ballad',
      slug: 'ballad',
      color: '#EF4444',
    },
  })

  // Create admin user
  await prisma.user.upsert({
    where: { email: 'admin@indiek.com' },
    update: {},
    create: {
      email: 'admin@indiek.com',
      username: 'admin',
      name: 'Admin User',
      role: 'ADMIN',
    },
  })

  console.log('✅ Database seeding completed!')
  console.log('📊 Created:')
  console.log('  - 3 Artists (IU, Dean, Heize)')
  console.log('  - 3 Songs')
  console.log('  - 3 Tags')
  console.log('  - 1 Admin User')
}

main()
  .then(async () => {
    await prisma.$disconnect()
  })
  .catch(async (e) => {
    console.error(e)
    await prisma.$disconnect()
    process.exit(1)
  })
