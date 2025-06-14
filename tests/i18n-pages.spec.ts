import { test, expect } from '@playwright/test';

// 지원하는 언어들
const locales = ['en', 'ko', 'es'];

// 테스트할 페이지들
const pages = [
  { path: '/', title: 'Home' },
  { path: '/artists', title: 'Artists' },
  { path: '/music', title: 'Music' },
  { path: '/posts', title: 'Community' },
  { path: '/search', title: 'Search' },
];

// 각 언어별 예상 텍스트 (번역 확인용)
const expectedTexts = {
  en: {
    home: 'Discover Korean Indie Artists',
    artists: 'Featured Artists',
    music: 'Latest Music',
    posts: 'Community',
    search: 'Search',
  },
  ko: {
    home: '한국 인디 아티스트를 만나보세요',
    artists: '추천 아티스트',
    music: '최신 음악',
    posts: '커뮤니티',
    search: '검색',
  },
  es: {
    home: 'Descubre Artistas Indie Coreanos',
    artists: 'Artistas Destacados',
    music: 'Música Más Reciente',
    posts: 'Comunidad',
    search: 'Buscar',
  },
};

test.describe('다국어 페이지 로딩 테스트', () => {
  for (const locale of locales) {
    test.describe(`${locale.toUpperCase()} 언어`, () => {
      for (const page of pages) {
        test(`${page.title} 페이지 (/${locale}${page.path}) 로딩 테스트`, async ({ page: playwright }) => {
          const url = `/${locale}${page.path}`;

          // 페이지 로딩
          await playwright.goto(url);

          // 페이지가 성공적으로 로드되었는지 확인
          await expect(playwright).toHaveURL(new RegExp(`/${locale}${page.path.replace('/', '/?')}`));

          // HTML lang 속성이 올바른지 확인
          const htmlElement = playwright.locator('html');
          await expect(htmlElement).toHaveAttribute('lang', locale);

          // 페이지 제목이 설정되어 있는지 확인
          await expect(playwright).toHaveTitle(/.+/);

          // 네비게이션이 존재하는지 확인
          const navigation = playwright.locator('nav');
          await expect(navigation).toBeVisible();

          // 언어 전환기가 존재하는지 확인
          const languageSwitcher = playwright.locator('[data-testid="language-switcher"]');
          await expect(languageSwitcher).toBeVisible();

          // 메인 콘텐츠가 존재하는지 확인
          const main = playwright.locator('main');
          await expect(main).toBeVisible();

          // 페이지별 특정 콘텐츠 확인
          if (page.path === '/') {
            // 홈페이지: 히어로 섹션 확인
            const heroSection = playwright.locator('h1, .hero, [data-testid="hero"]');
            await expect(heroSection.first()).toBeVisible();
          } else if (page.path === '/artists') {
            // 아티스트 페이지: 아티스트 목록 또는 제목 확인
            const artistsContent = playwright.locator('h1, .artists, [data-testid="artists"]');
            await expect(artistsContent.first()).toBeVisible();
          } else if (page.path === '/music') {
            // 음악 페이지: 음악 목록 또는 제목 확인
            const musicContent = playwright.locator('h1, .music, [data-testid="music"]');
            await expect(musicContent.first()).toBeVisible();
          } else if (page.path === '/posts') {
            // 커뮤니티 페이지: 포스트 목록 또는 제목 확인
            const postsContent = playwright.locator('h1, .posts, .community, [data-testid="posts"]');
            await expect(postsContent.first()).toBeVisible();
          } else if (page.path === '/search') {
            // 검색 페이지: 검색 입력 필드 확인
            const searchInput = playwright.locator('input[type="search"], input[placeholder*="search"], input[placeholder*="검색"], input[placeholder*="buscar"]');
            await expect(searchInput.first()).toBeVisible();
          }

          // 페이지 로딩 시간 확인 (5초 이내)
          const startTime = Date.now();
          await playwright.waitForLoadState('networkidle');
          const loadTime = Date.now() - startTime;
          expect(loadTime).toBeLessThan(5000);

          // 콘솔 에러가 없는지 확인
          const errors: string[] = [];
          playwright.on('console', msg => {
            if (msg.type() === 'error') {
              errors.push(msg.text());
            }
          });

          // 잠시 대기하여 콘솔 에러 수집
          await playwright.waitForTimeout(1000);

          // 중요한 에러만 체크 (일반적인 개발 환경 에러는 제외)
          const criticalErrors = errors.filter(error =>
            !error.includes('favicon.ico') &&
            !error.includes('_next/static') &&
            !error.includes('hot-reload')
          );

          expect(criticalErrors).toHaveLength(0);
        });
      }

      test(`${locale.toUpperCase()} 언어 전환 테스트`, async ({ page: playwright }) => {
        // 홈페이지에서 시작
        await playwright.goto(`/${locale}/`);

        // 다른 언어로 전환 테스트
        const otherLocales = locales.filter(l => l !== locale);

        for (const targetLocale of otherLocales) {
          // 언어 전환기 찾기
          const languageSwitcher = playwright.locator('[data-testid="language-switcher"]');

          if (await languageSwitcher.isVisible()) {
            // select 요소에서 언어 선택
            await languageSwitcher.selectOption(targetLocale);

            // 페이지 로딩 대기
            await playwright.waitForLoadState('networkidle');

            // URL이 변경되었는지 확인
            await expect(playwright).toHaveURL(new RegExp(`/${targetLocale}/`));

            // HTML lang 속성이 변경되었는지 확인
            const htmlElement = playwright.locator('html');
            await expect(htmlElement).toHaveAttribute('lang', targetLocale);

            // 다시 원래 언어로 돌아가기
            await languageSwitcher.selectOption(locale);
            await playwright.waitForLoadState('networkidle');
          }
        }
      });
    });
  }

  test('모든 언어의 기본 라우팅 테스트', async ({ page: playwright }) => {
    // 루트 경로 접속 시 기본 언어로 리다이렉트되는지 확인
    await playwright.goto('/');

    // 기본 언어(en)로 리다이렉트되어야 함
    await expect(playwright).toHaveURL(/\/en\//);

    // HTML lang 속성이 올바른지 확인
    const htmlElement = playwright.locator('html');
    await expect(htmlElement).toHaveAttribute('lang', 'en');
  });

  test('잘못된 언어 코드 처리 테스트', async ({ page: playwright }) => {
    // 존재하지 않는 언어 코드로 접속
    const response = await playwright.goto('/invalid-locale/', { waitUntil: 'networkidle' });

    // 404 페이지나 기본 언어로 리다이렉트되어야 함
    expect(response?.status()).toBe(404);
  });
});
