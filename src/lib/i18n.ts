// 지원하는 언어 목록
export const SUPPORTED_LOCALES = ['en', 'ko', 'es'] as const;
export type Locale = typeof SUPPORTED_LOCALES[number];
export const DEFAULT_LOCALE: Locale = 'en';

// 언어별 메시지
const messages = {
  en: {
    // Navigation
    'nav.home': 'Home',
    'nav.artists': 'Artists',
    'nav.music': 'Music',
    'nav.community': 'Community',
    'nav.search': 'Search',
    'nav.admin': 'Admin',
    'nav.signin': 'Sign In',
    'nav.signup': 'Sign Up',
    'nav.signout': 'Sign Out',

    // Home page
    'home.title': 'Discover Korean Indie Artists',
    'home.subtitle': 'Explore the vibrant world of Korean independent music',
    'home.featured_artists': 'Featured Artists',
    'home.latest_music': 'Latest Music',
    'home.explore_button': 'Explore Now',

    // Artists page
    'artists.title': 'Artists',
    'artists.featured': 'Featured Artists',
    'artists.all': 'All Artists',
    'artists.genre': 'Genre',
    'artists.location': 'Location',

    // Music page
    'music.title': 'Music',
    'music.latest': 'Latest Releases',
    'music.popular': 'Popular Tracks',
    'music.albums': 'Albums',
    'music.singles': 'Singles',

    // Community page
    'community.title': 'Community',
    'community.latest_posts': 'Latest Posts',
    'community.create_post': 'Create Post',
    'community.discussions': 'Discussions',

    // Search page
    'search.title': 'Search',
    'search.placeholder': 'Search artists, music, posts...',
    'search.results': 'Search Results',
    'search.no_results': 'No results found',

    // Common
    'common.loading': 'Loading...',
    'common.error': 'An error occurred',
    'common.save': 'Save',
    'common.cancel': 'Cancel',
    'common.delete': 'Delete',
    'common.edit': 'Edit',
    'common.view': 'View',
    'common.back': 'Back',
    'common.next': 'Next',
    'common.previous': 'Previous',
  },
  ko: {
    // Navigation
    'nav.home': '홈',
    'nav.artists': '아티스트',
    'nav.music': '음악',
    'nav.community': '커뮤니티',
    'nav.search': '검색',
    'nav.admin': '관리자',
    'nav.signin': '로그인',
    'nav.signup': '회원가입',
    'nav.signout': '로그아웃',

    // Home page
    'home.title': '한국 인디 아티스트를 만나보세요',
    'home.subtitle': '한국 독립 음악의 생생한 세계를 탐험해보세요',
    'home.featured_artists': '추천 아티스트',
    'home.latest_music': '최신 음악',
    'home.explore_button': '지금 탐험하기',

    // Artists page
    'artists.title': '아티스트',
    'artists.featured': '추천 아티스트',
    'artists.all': '모든 아티스트',
    'artists.genre': '장르',
    'artists.location': '지역',

    // Music page
    'music.title': '음악',
    'music.latest': '최신 발매',
    'music.popular': '인기 트랙',
    'music.albums': '앨범',
    'music.singles': '싱글',

    // Community page
    'community.title': '커뮤니티',
    'community.latest_posts': '최신 게시물',
    'community.create_post': '게시물 작성',
    'community.discussions': '토론',

    // Search page
    'search.title': '검색',
    'search.placeholder': '아티스트, 음악, 게시물 검색...',
    'search.results': '검색 결과',
    'search.no_results': '검색 결과가 없습니다',

    // Common
    'common.loading': '로딩 중...',
    'common.error': '오류가 발생했습니다',
    'common.save': '저장',
    'common.cancel': '취소',
    'common.delete': '삭제',
    'common.edit': '편집',
    'common.view': '보기',
    'common.back': '뒤로',
    'common.next': '다음',
    'common.previous': '이전',
  },
  es: {
    // Navigation
    'nav.home': 'Inicio',
    'nav.artists': 'Artistas',
    'nav.music': 'Música',
    'nav.community': 'Comunidad',
    'nav.search': 'Buscar',
    'nav.admin': 'Admin',
    'nav.signin': 'Iniciar Sesión',
    'nav.signup': 'Registrarse',
    'nav.signout': 'Cerrar Sesión',

    // Home page
    'home.title': 'Descubre Artistas Indie Coreanos',
    'home.subtitle': 'Explora el vibrante mundo de la música independiente coreana',
    'home.featured_artists': 'Artistas Destacados',
    'home.latest_music': 'Música Más Reciente',
    'home.explore_button': 'Explorar Ahora',

    // Artists page
    'artists.title': 'Artistas',
    'artists.featured': 'Artistas Destacados',
    'artists.all': 'Todos los Artistas',
    'artists.genre': 'Género',
    'artists.location': 'Ubicación',

    // Music page
    'music.title': 'Música',
    'music.latest': 'Últimos Lanzamientos',
    'music.popular': 'Pistas Populares',
    'music.albums': 'Álbumes',
    'music.singles': 'Sencillos',

    // Community page
    'community.title': 'Comunidad',
    'community.latest_posts': 'Últimas Publicaciones',
    'community.create_post': 'Crear Publicación',
    'community.discussions': 'Discusiones',

    // Search page
    'search.title': 'Buscar',
    'search.placeholder': 'Buscar artistas, música, publicaciones...',
    'search.results': 'Resultados de Búsqueda',
    'search.no_results': 'No se encontraron resultados',

    // Common
    'common.loading': 'Cargando...',
    'common.error': 'Ocurrió un error',
    'common.save': 'Guardar',
    'common.cancel': 'Cancelar',
    'common.delete': 'Eliminar',
    'common.edit': 'Editar',
    'common.view': 'Ver',
    'common.back': 'Atrás',
    'common.next': 'Siguiente',
    'common.previous': 'Anterior',
  },
} as const;

// 현재 언어 상태
let currentLocale: Locale = DEFAULT_LOCALE;

// 언어 설정
export function setLocale(locale: Locale) {
  if (SUPPORTED_LOCALES.includes(locale)) {
    currentLocale = locale;
    // 로컬 스토리지에 저장 (클라이언트 사이드에서만)
    if (typeof window !== 'undefined') {
      localStorage.setItem('locale', locale);
    }
  }
}

// 현재 언어 가져오기
export function getLocale(): Locale {
  return currentLocale;
}

// 번역 함수
export function t(key: string, locale?: Locale): string {
  const targetLocale = locale || getLocale();
  const message = messages[targetLocale]?.[key as keyof typeof messages[typeof targetLocale]];

  if (message) {
    return message;
  }

  // 기본 언어로 폴백
  const fallbackMessage = messages[DEFAULT_LOCALE]?.[key as keyof typeof messages[typeof DEFAULT_LOCALE]];
  if (fallbackMessage) {
    return fallbackMessage;
  }

  // 키를 그대로 반환 (개발 중 누락된 번역 확인용)
  return key;
}

// 언어별 라벨
export const LOCALE_LABELS = {
  en: 'English',
  ko: '한국어',
  es: 'Español',
} as const;
