type PageMetaConfig = {
  title: string;
  description: string;
  url?: string;
  image?: string;
  audio?: string;
};

function upsertMetaByName(name: string, content: string) {
  if (typeof document === 'undefined') return;
  let element = document.querySelector(`meta[name="${name}"]`) as HTMLMetaElement | null;
  if (!element) {
    element = document.createElement('meta');
    element.setAttribute('name', name);
    document.head.appendChild(element);
  }
  element.setAttribute('content', content);
}

function upsertMetaByProperty(property: string, content: string) {
  if (typeof document === 'undefined') return;
  let element = document.querySelector(`meta[property="${property}"]`) as HTMLMetaElement | null;
  if (!element) {
    element = document.createElement('meta');
    element.setAttribute('property', property);
    document.head.appendChild(element);
  }
  element.setAttribute('content', content);
}

export function setPageMeta(config: PageMetaConfig): void {
  if (typeof document === 'undefined') return;

  document.title = config.title;
  upsertMetaByName('description', config.description);

  upsertMetaByProperty('og:title', config.title);
  upsertMetaByProperty('og:description', config.description);
  upsertMetaByProperty('og:type', 'music.song');
  upsertMetaByProperty('og:site_name', 'MusicForge');

  if (config.url) {
    upsertMetaByProperty('og:url', config.url);
  }
  if (config.image) {
    upsertMetaByProperty('og:image', config.image);
  }
  if (config.audio) {
    upsertMetaByProperty('og:audio', config.audio);
  }
}
