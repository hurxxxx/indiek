import { test, expect } from '@playwright/test';

// 지원하는 언어들
const locales = ['en', 'ko', 'es'];

test.describe('기본 다국어 테스트', () => {
  test('홈페이지 로딩 테스트 - 영어', async ({ page }) => {
    await page.goto('/en');

    // 페이지가 성공적으로 로드되었는지 확인 (URL 패턴 수정)
    await expect(page).toHaveURL(/\/en/);

    // HTML lang 속성이 올바른지 확인
    const htmlElement = page.locator('html');
    await expect(htmlElement).toHaveAttribute('lang', 'en');

    // 페이지 제목이 설정되어 있는지 확인
    await expect(page).toHaveTitle(/.+/);

    // 네비게이션이 존재하는지 확인
    const navigation = page.locator('nav');
    await expect(navigation).toBeVisible();

    // 언어 전환기가 존재하는지 확인
    const languageSwitcher = page.locator('[data-testid="language-switcher"]');
    await expect(languageSwitcher).toBeVisible();

    // 메인 콘텐츠가 존재하는지 확인
    const main = page.locator('main');
    await expect(main).toBeVisible();
  });

  test('홈페이지 로딩 테스트 - 한국어', async ({ page }) => {
    await page.goto('/ko');

    // 페이지가 성공적으로 로드되었는지 확인
    await expect(page).toHaveURL(/\/ko/);

    // HTML lang 속성이 올바른지 확인
    const htmlElement = page.locator('html');
    await expect(htmlElement).toHaveAttribute('lang', 'ko');

    // 페이지 제목이 설정되어 있는지 확인
    await expect(page).toHaveTitle(/.+/);

    // 네비게이션이 존재하는지 확인
    const navigation = page.locator('nav');
    await expect(navigation).toBeVisible();

    // 언어 전환기가 존재하는지 확인
    const languageSwitcher = page.locator('[data-testid="language-switcher"]');
    await expect(languageSwitcher).toBeVisible();

    // 메인 콘텐츠가 존재하는지 확인
    const main = page.locator('main');
    await expect(main).toBeVisible();
  });

  test('홈페이지 로딩 테스트 - 스페인어', async ({ page }) => {
    await page.goto('/es');

    // 페이지가 성공적으로 로드되었는지 확인
    await expect(page).toHaveURL(/\/es/);

    // HTML lang 속성이 올바른지 확인
    const htmlElement = page.locator('html');
    await expect(htmlElement).toHaveAttribute('lang', 'es');

    // 페이지 제목이 설정되어 있는지 확인
    await expect(page).toHaveTitle(/.+/);

    // 네비게이션이 존재하는지 확인
    const navigation = page.locator('nav');
    await expect(navigation).toBeVisible();

    // 언어 전환기가 존재하는지 확인
    const languageSwitcher = page.locator('[data-testid="language-switcher"]');
    await expect(languageSwitcher).toBeVisible();

    // 메인 콘텐츠가 존재하는지 확인
    const main = page.locator('main');
    await expect(main).toBeVisible();
  });

  test('언어 전환 테스트', async ({ page }) => {
    // 영어 홈페이지에서 시작
    await page.goto('/en');

    // 언어 전환기 찾기
    const languageSwitcher = page.locator('[data-testid="language-switcher"]');
    await expect(languageSwitcher).toBeVisible();

    // 한국어로 전환
    await languageSwitcher.selectOption('ko');
    await page.waitForLoadState('networkidle');

    // URL이 변경되었는지 확인
    await expect(page).toHaveURL(/\/ko/);

    // HTML lang 속성이 변경되었는지 확인
    const htmlElement = page.locator('html');
    await expect(htmlElement).toHaveAttribute('lang', 'ko');

    // 스페인어로 전환
    await languageSwitcher.selectOption('es');
    await page.waitForLoadState('networkidle');

    // URL이 변경되었는지 확인
    await expect(page).toHaveURL(/\/es/);

    // HTML lang 속성이 변경되었는지 확인
    await expect(htmlElement).toHaveAttribute('lang', 'es');
  });

  test('기본 라우팅 테스트', async ({ page }) => {
    // 루트 경로 접속 시 기본 언어로 리다이렉트되는지 확인
    await page.goto('/');

    // 기본 언어(en)로 리다이렉트되어야 함
    await expect(page).toHaveURL(/\/en/);

    // HTML lang 속성이 올바른지 확인
    const htmlElement = page.locator('html');
    await expect(htmlElement).toHaveAttribute('lang', 'en');
  });
});
