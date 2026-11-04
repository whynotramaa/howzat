import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { expect, it } from 'vitest';
import { Input, Select, Textarea } from '../src/components/ui/Input';
import { Tabs } from '../src/components/ui/Tabs';

it('associates errors with every shared field type', () => {
  for (const component of [Input, Select, Textarea]) {
    const html = renderToStaticMarkup(
      createElement(component, {
        id: 'player-name',
        label: 'Player',
        error: 'Required',
      }),
    );
    expect(html).toContain('for="player-name"');
    expect(html).toContain('aria-invalid="true"');
    expect(html).toContain('aria-describedby="player-name-error"');
    expect(html).toContain('id="player-name-error"');
  }
});

it('keeps password reveal in keyboard navigation', () => {
  const html = renderToStaticMarkup(createElement(Input, { label: 'Password', type: 'password' }));
  expect(html).toContain('aria-label="Show password"');
  expect(html).not.toContain('tabindex="-1"');
});

it('uses ordinary toggle buttons for view selection', () => {
  const html = renderToStaticMarkup(
    createElement(Tabs, {
      items: [
        { value: 'live', label: 'Live' },
        { value: 'card', label: 'Scorecard' },
      ],
      value: 'card',
      onChange: () => {},
    }),
  );
  expect(html).toContain('role="group"');
  expect(html).toContain('aria-pressed="true"');
  expect(html).toContain('aria-pressed="false"');
  expect(html).not.toContain('role="tab"');
});
