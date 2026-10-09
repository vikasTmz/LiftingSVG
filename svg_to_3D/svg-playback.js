'use strict';

function svgClockSeconds(value) {
  const text = String(value || '').trim();
  if (/^[+-]?\d+(?::\d+){1,2}(?:\.\d+)?$/.test(text)) {
    const sign = text.startsWith('-') ? -1 : 1;
    return sign * text.replace(/^[+-]/, '').split(':').reduce((total, part) => total * 60 + Number(part), 0);
  }
  const match = /^([+-]?(?:\d*\.)?\d+)(ms|s|min|h)?$/.exec(text);
  return match ? Number(match[1]) * ({ ms: .001, s: 1, min: 60, h: 3600 }[match[2] || 's']) : null;
}

function createSVGPlayback(root, prefix, durationOverride) {
  const $ = id => root.querySelector(`#${prefix}${id}`);
  const stage = $('svg-stage'), bar = $('svg-playback'), slider = $('svg-timeline'), button = $('svg-play-pause');
  let svg = null, cssAnimations = [], duration = 0, sceneDuration = 0, sceneLoops = false;
  let time = 0, playing = !matchMedia('(prefers-reduced-motion: reduce)').matches;
  let visible = true, frameRequest = null, lastFrame = null;
  const format = seconds => {
    const tenths = Math.floor(seconds * 10 + 1e-6);
    return `${Math.floor(tenths / 600)}:${((tenths % 600) / 10).toFixed(1).padStart(4, '0')}`;
  };

  function updateControls() {
    button.setAttribute('aria-label', playing ? 'Pause animation' : 'Play animation');
    button.title = playing ? 'Pause animation' : 'Play animation';
    button.querySelector('use').setAttribute('href', playing ? '#i-pause' : '#i-play');
    slider.max = duration;
    slider.value = time;
    slider.setAttribute('aria-valuetext', `${format(time)} of ${format(duration)}`);
    $('svg-time').textContent = format(time); $('svg-duration').textContent = format(duration);
  }
  function applyTime() {
    if (svg) svg.setCurrentTime(time);
    cssAnimations.forEach(animation => { animation.currentTime = time * 1000; });
    updateControls();
  }
  function stopClock() {
    if (frameRequest !== null) cancelAnimationFrame(frameRequest);
    frameRequest = null; lastFrame = null;
  }
  function tick(now) {
    frameRequest = null;
    if (lastFrame !== null) time += (now - lastFrame) / 1000;
    lastFrame = now;
    if (time >= duration) {
      if (sceneLoops) time %= duration;
      else { time = duration; playing = false; }
    }
    applyTime();
    if (playing) startClock(); else stopClock();
  }
  function startClock() {
    if (svg && duration > 0 && playing && visible && !document.hidden && frameRequest === null) frameRequest = requestAnimationFrame(tick);
  }
  function detach() {
    stopClock(); svg = null; cssAnimations = []; bar.hidden = true;
    stage.classList.remove('has-animation');
  }
  function attach(document, composite) {
    const element = document.querySelector('svg');
    const smil = [...element.querySelectorAll('animate, animateTransform, animateMotion, set')];
    cssAnimations = document.getAnimations();
    let inferredDuration = 0, loops = false;
    smil.forEach(animation => {
      const starts = (animation.getAttribute('begin') || '0s').split(';').map(svgClockSeconds).filter(value => value !== null);
      const start = starts.length ? Math.max(...starts) : 0;
      const length = svgClockSeconds(animation.getAttribute('dur')) || 0;
      const repeat = animation.getAttribute('repeatCount');
      const indefinite = repeat === 'indefinite';
      let active = length * (indefinite ? 1 : Number(repeat || 1));
      const repeatDuration = svgClockSeconds(animation.getAttribute('repeatDur'));
      if (repeatDuration !== null) active = indefinite || !repeat ? repeatDuration : Math.min(active, repeatDuration);
      const end = svgClockSeconds(animation.getAttribute('end'));
      inferredDuration = Math.max(inferredDuration, end === null ? start + active : Math.min(start + active, end));
      // Delayed repeating details (e.g. ripples) do not loop an entire finite scene.
      loops ||= indefinite && repeatDuration === null && end === null && starts.some(value => value <= 0);
    });
    cssAnimations.forEach(animation => {
      const timing = animation.effect.getComputedTiming();
      const indefinite = timing.iterations === Infinity;
      inferredDuration = Math.max(inferredDuration, (indefinite ? timing.delay + timing.duration : timing.endTime) / 1000);
      loops ||= indefinite && timing.delay <= 0;
      animation.pause();
    });
    element.pauseAnimations();
    if (!smil.length && !cssAnimations.length) return; // No controls on a static layer.
    if (composite) {
      sceneDuration = Number(durationOverride) > 0 ? Number(durationOverride) : inferredDuration || 5;
      sceneLoops = loops;
    }
    duration = Math.max(.001, Math.round((sceneDuration || inferredDuration || 5) * 1000) / 1000);
    svg = element; time = Math.min(time, duration);
    bar.hidden = false; stage.classList.add('has-animation');
    applyTime(); startClock();
  }
  button.addEventListener('click', () => {
    playing = !playing;
    if (playing && time >= duration) time = 0;
    stopClock(); applyTime(); startClock();
  });
  slider.addEventListener('input', () => {
    // Seeking pauses at the selected pose until the visitor presses play.
    playing = false; stopClock(); time = Number(slider.value); applyTime();
  });
  slider.addEventListener('keydown', event => event.stopPropagation());
  document.addEventListener('visibilitychange', () => { stopClock(); startClock(); });
  const observer = new IntersectionObserver(entries => {
    visible = entries[0].isIntersecting; stopClock(); startClock();
  }, { rootMargin: '100px' });
  observer.observe(stage);
  window.addEventListener('pagehide', () => { detach(); observer.disconnect(); }, { once: true });
  return { attach, detach };
}
