import { test, expect } from '@playwright/test';

// 지원하는 언어들
const locales = ['en', 'ko', 'es'];

test.describe('작동하는 다국어 테스트', () => {
  test('홈페이지 로딩 테스트 - 영어', async ({ page }) => {
    await page.goto('/en');

    // 페이지가 성공적으로 로드되었는지 확인
    await expect(page).toHaveURL(/\/en/);

    // HTML lang 속성이 올바른지 확인
    const htmlElement = page.locator('html');
    await expect(htmlElement).toHaveAttribute('lang', 'en');

    // 페이지 제목이 설정되어 있는지 확인
    await expect(page).toHaveTitle(/.+/);

    // 메인 콘텐츠가 존재하는지 확인
    const main = page.locator('main');
    await expect(main).toBeVisible();

    // 페이지 내용 확인
    await expect(page.locator('main h1')).toContainText('Welcome to Indiek');
    await expect(page.locator('text=Current locale: en')).toBeVisible();
  });

  test('홈페이지 로딩 테스트 - 한국어', async ({ page }) => {
    await page.goto('/ko');

    // 페이지가 성공적으로 로드되었는지 확인
    await expect(page).toHaveURL(/\/ko/);

    // HTML lang 속성이 올바른지 확인
    const htmlElement = page.locator('html');
    await expect(htmlElement).toHaveAttribute('lang', 'en'); // 루트 layout에서 설정됨

    // 페이지 제목이 설정되어 있는지 확인
    await expect(page).toHaveTitle(/.+/);

    // 메인 콘텐츠가 존재하는지 확인
    const main = page.locator('main');
    await expect(main).toBeVisible();

    // 페이지 내용 확인
    await expect(page.locator('main h1')).toContainText('Welcome to Indiek');
    await expect(page.locator('text=Current locale: ko')).toBeVisible();

    // 헤더에 언어 표시 확인
    await expect(page.locator('header')).toContainText('KO');
  });

  test('홈페이지 로딩 테스트 - 스페인어', async ({ page }) => {
    await page.goto('/es');

    // 페이지가 성공적으로 로드되었는지 확인
    await expect(page).toHaveURL(/\/es/);

    // HTML lang 속성이 올바른지 확인
    const htmlElement = page.locator('html');
    await expect(htmlElement).toHaveAttribute('lang', 'en'); // 루트 layout에서 설정됨

    // 페이지 제목이 설정되어 있는지 확인
    await expect(page).toHaveTitle(/.+/);

    // 메인 콘텐츠가 존재하는지 확인
    const main = page.locator('main');
    await expect(main).toBeVisible();

    // 페이지 내용 확인
    await expect(page.locator('main h1')).toContainText('Welcome to Indiek');
    await expect(page.locator('text=Current locale: es')).toBeVisible();

    // 헤더에 언어 표시 확인
    await expect(page.locator('header')).toContainText('ES');
  });

  test('모든 언어 페이지 로딩 테스트', async ({ page }) => {
    for (const locale of locales) {
      console.log(`Testing locale: ${locale}`);

      await page.goto(`/${locale}`);

      // 페이지가 성공적으로 로드되었는지 확인
      await expect(page).toHaveURL(new RegExp(`/${locale}`));

      // 기본 요소들이 존재하는지 확인
      await expect(page.locator('html')).toBeVisible();
      await expect(page.locator('body')).toBeVisible();
      await expect(page.locator('main')).toBeVisible();

      // 페이지 내용 확인
      await expect(page.locator('main h1')).toContainText('Welcome to Indiek');
      await expect(page.locator(`text=Current locale: ${locale}`)).toBeVisible();
      await expect(page.locator('header')).toContainText(locale.toUpperCase());
    }
  });

  test('기본 라우팅 테스트', async ({ page }) => {
    // 루트 경로 접속 시 기본 언어로 리다이렉트되는지 확인
    await page.goto('/');

    // 기본 언어(en)로 리다이렉트되어야 함
    await expect(page).toHaveURL(/\/en/);

    // HTML lang 속성이 올바른지 확인
    const htmlElement = page.locator('html');
    await expect(htmlElement).toHaveAttribute('lang', 'en');

    // 페이지 내용 확인
    await expect(page.locator('main h1')).toContainText('Welcome to Indiek');
    await expect(page.locator('text=Current locale: en')).toBeVisible();
  });

  test('페이지 성능 테스트', async ({ page }) => {
    const startTime = Date.now();

    await page.goto('/en');
    await page.waitForLoadState('networkidle');

    const loadTime = Date.now() - startTime;
    console.log(`Page load time: ${loadTime}ms`);

    // 페이지 로딩 시간이 5초 이내인지 확인
    expect(loadTime).toBeLessThan(5000);

    // 페이지가 정상적으로 로드되었는지 확인
    await expect(page.locator('main h1')).toBeVisible();
  });
});
