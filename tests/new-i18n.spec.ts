import { test, expect } from '@playwright/test';

test.describe('새로운 i18n 시스템 테스트', () => {
  test('홈페이지 로딩 및 기본 언어 확인', async ({ page }) => {
    await page.goto('/');
    
    // 페이지가 성공적으로 로드되었는지 확인
    await expect(page).toHaveURL('/');
    
    // 기본 콘텐츠가 영어로 표시되는지 확인
    await expect(page.locator('h1')).toContainText('Discover Korean Indie Artists');
    
    // 네비게이션 메뉴가 영어로 표시되는지 확인
    await expect(page.locator('nav')).toContainText('Home');
    await expect(page.locator('nav')).toContainText('Artists');
    await expect(page.locator('nav')).toContainText('Music');
    await expect(page.locator('nav')).toContainText('Community');
    
    // 언어 전환기가 존재하는지 확인
    const languageSwitcher = page.locator('[data-testid="language-switcher"]');
    await expect(languageSwitcher).toBeVisible();
    await expect(languageSwitcher).toHaveValue('en');
  });

  test('한국어로 언어 전환', async ({ page }) => {
    await page.goto('/');
    
    // 언어 전환기에서 한국어 선택
    const languageSwitcher = page.locator('[data-testid="language-switcher"]');
    await languageSwitcher.selectOption('ko');
    
    // 잠시 대기 (언어 변경 처리)
    await page.waitForTimeout(500);
    
    // 콘텐츠가 한국어로 변경되었는지 확인
    await expect(page.locator('h1')).toContainText('한국 인디 아티스트를 만나보세요');
    
    // 네비게이션 메뉴가 한국어로 변경되었는지 확인
    await expect(page.locator('nav')).toContainText('홈');
    await expect(page.locator('nav')).toContainText('아티스트');
    await expect(page.locator('nav')).toContainText('음악');
    await expect(page.locator('nav')).toContainText('커뮤니티');
    
    // 언어 전환기 값이 변경되었는지 확인
    await expect(languageSwitcher).toHaveValue('ko');
  });

  test('스페인어로 언어 전환', async ({ page }) => {
    await page.goto('/');
    
    // 언어 전환기에서 스페인어 선택
    const languageSwitcher = page.locator('[data-testid="language-switcher"]');
    await languageSwitcher.selectOption('es');
    
    // 잠시 대기 (언어 변경 처리)
    await page.waitForTimeout(500);
    
    // 콘텐츠가 스페인어로 변경되었는지 확인
    await expect(page.locator('h1')).toContainText('Descubre Artistas Indie Coreanos');
    
    // 네비게이션 메뉴가 스페인어로 변경되었는지 확인
    await expect(page.locator('nav')).toContainText('Inicio');
    await expect(page.locator('nav')).toContainText('Artistas');
    await expect(page.locator('nav')).toContainText('Música');
    await expect(page.locator('nav')).toContainText('Comunidad');
    
    // 언어 전환기 값이 변경되었는지 확인
    await expect(languageSwitcher).toHaveValue('es');
  });

  test('언어 설정 지속성 확인', async ({ page }) => {
    await page.goto('/');
    
    // 한국어로 변경
    const languageSwitcher = page.locator('[data-testid="language-switcher"]');
    await languageSwitcher.selectOption('ko');
    await page.waitForTimeout(500);
    
    // 페이지 새로고침
    await page.reload();
    await page.waitForTimeout(1000);
    
    // 언어 설정이 유지되었는지 확인
    await expect(languageSwitcher).toHaveValue('ko');
    await expect(page.locator('h1')).toContainText('한국 인디 아티스트를 만나보세요');
  });

  test('모든 언어 옵션 확인', async ({ page }) => {
    await page.goto('/');
    
    const languageSwitcher = page.locator('[data-testid="language-switcher"]');
    
    // 모든 언어 옵션이 존재하는지 확인
    const options = await languageSwitcher.locator('option').allTextContents();
    expect(options).toContain('English');
    expect(options).toContain('한국어');
    expect(options).toContain('Español');
  });

  test('페이지 성능 테스트', async ({ page }) => {
    const startTime = Date.now();
    
    await page.goto('/');
    await page.waitForLoadState('networkidle');
    
    const loadTime = Date.now() - startTime;
    console.log(`Page load time: ${loadTime}ms`);
    
    // 페이지 로딩 시간이 3초 이내인지 확인
    expect(loadTime).toBeLessThan(3000);
    
    // 기본 요소들이 로드되었는지 확인
    await expect(page.locator('nav')).toBeVisible();
    await expect(page.locator('main')).toBeVisible();
    await expect(page.locator('h1')).toBeVisible();
  });
});
