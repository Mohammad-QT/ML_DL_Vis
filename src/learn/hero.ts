const transitions = new WeakMap<HTMLElement, Animation>();

export function setLessonHeroStep(step: number) {
  const hero = document.querySelector<HTMLElement>('main > .hero');
  const compact = step > 0;
  if (!hero || hero.classList.contains('compact') === compact) return;

  const from = hero.getBoundingClientRect().height;
  transitions.get(hero)?.cancel();
  hero.classList.toggle('compact', compact);
  if (!hero.animate || window.matchMedia?.('(prefers-reduced-motion: reduce)').matches) return;

  const to = hero.getBoundingClientRect().height;
  transitions.set(hero, hero.animate(
    [{ height: `${from}px`, overflow: 'clip' }, { height: `${to}px`, overflow: 'clip' }],
    { duration: 300, easing: 'ease-in-out' },
  ));
}
