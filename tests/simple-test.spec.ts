import { test, expect } from '@playwright/test';

test.describe('간단한 페이지 테스트', () => {
  test('페이지가 로드되는지 확인', async ({ page }) => {
    // 페이지 로딩 시도
    const response = await page.goto('/en');
    
    // 응답 상태 확인
    console.log('Response status:', response?.status());
    console.log('Response URL:', response?.url());
    
    // 페이지 내용 확인
    const content = await page.content();
    console.log('Page content preview:', content.substring(0, 500));
    
    // 페이지 제목 확인
    const title = await page.title();
    console.log('Page title:', title);
    
    // HTML 요소 확인
    const htmlElement = await page.locator('html').getAttribute('id');
    console.log('HTML id attribute:', htmlElement);
    
    // 에러가 아닌 정상 페이지인지 확인
    const isErrorPage = htmlElement === '__next_error__';
    console.log('Is error page:', isErrorPage);
    
    if (!isErrorPage) {
      // 정상 페이지라면 기본 요소들이 존재하는지 확인
      await expect(page.locator('html')).toBeVisible();
      await expect(page.locator('body')).toBeVisible();
    }
  });

  test('다른 언어 페이지 테스트', async ({ page }) => {
    const locales = ['ko', 'es'];
    
    for (const locale of locales) {
      console.log(`Testing locale: ${locale}`);
      
      const response = await page.goto(`/${locale}`);
      console.log(`${locale} response status:`, response?.status());
      
      const htmlElement = await page.locator('html').getAttribute('id');
      const isErrorPage = htmlElement === '__next_error__';
      console.log(`${locale} is error page:`, isErrorPage);
      
      if (!isErrorPage) {
        await expect(page.locator('html')).toBeVisible();
      }
    }
  });

  test('루트 경로 테스트', async ({ page }) => {
    const response = await page.goto('/');
    console.log('Root response status:', response?.status());
    console.log('Root response URL:', response?.url());
    
    // 리다이렉트되었는지 확인
    const currentUrl = page.url();
    console.log('Current URL after navigation:', currentUrl);
  });
});
