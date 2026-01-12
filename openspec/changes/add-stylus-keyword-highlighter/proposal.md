# Change: Add Stylus keyword highlighter

## Why
Users want a lightweight way to highlight multiple keywords with distinct colors and strike-through excluded terms on sites like Gmail, with settings that persist across page navigations.

## What Changes
- Add a Stylus user-script that overlays a small toast UI to enter comma-separated keywords to highlight and to strike through.
- Persist highlight and exclude lists with color mapping across page loads using localStorage.
- Highlight all keyword occurrences in the current page with distinct colors per keyword and strike through excluded terms.

## Impact
- Affected specs: keyword-highlighter
- Affected code: new Stylus script (single file)
