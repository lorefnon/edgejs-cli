# edgejs-cli

:warning: Maturity Level: Alpha

Minimal CLI utility to generate files using edge.js templates

## Usage

```sh
pnpm i -g edgejs-cli
# ^ Will add an edget utility to PATH

# Render a single template
edget -i templates/home.edge -o site
# ^ Generates home.html by rendering home.edge

# Pass data to templates through a JSON/YAML file
edget -i templates/home.edge -o site -d data.json
# ^ Same as above but home.edge can use any values defined in data.json

# Render all templates in a directory (Files prefixed with . or _ are ignored)
edget -i templates -o site -d data.json

# Skip escaping if generating non-html content
edget -i sql-templates -o sql --skipEscaping
```

## Use cases

This is intended to be a minimal utility that simplifies tasks like below for JS/TS developers comfortable with CLI:

- Building static sites
- Knowledge-graphs
- Code generation

## Motivations

If you don't care about cross-language support, edgejs is easier than Handlebars/mustache/liquid etc.
because the embedded expressions are plain JS - so there is less need to learn custom syntax specific
to the templating language, and we also have first class support for async.

Also unlike JSX based solutions, it is more versatile because it is not limited to HTML

---

:warning: This project has nothing to do with Microsoft edge browser.
