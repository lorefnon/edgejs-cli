# edgejs-cli

:warning: Maturity Level: Alpha

Minimal CLI utility to generate files using edge.js templates

## Usage

```sh
pnpm i -g edgejs-cli
# ^ Will add an edget utility to PATH

# Render a single template
edget -i templates/home.edge -o site
# ^ Generates site/home.html by rendering home.edge

# Pass data to templates through a JSON/YAML file
edget -i templates/home.edge -o site -d data.json
# ^ Same as above but home.edge can use any values defined in data.json

# Render all templates within a directory (Files prefixed with . or _ are ignored)
edget -i templates -o site -d data.json

# Skip escaping if generating non-html content
edget -i sql-templates -o sql --skipEscaping
```

## Advanced features

### Multi-mode

It is not necessary that each input file generate exactly one input file, or that the output file name match input file name.

With multi-mode, we can render an output in the following format (inspired by Vue SFC):

```xml
<!-- post.multi.edge -->
<file path="post/summary.html">
Here is some summary content
</file>
<file path="post/details.html">
Here are some details
</file>
```

Note that the file extension needs to be `.multi.edge`.

This will generate two files `<out-dir>/post/summary.html` with content `Here is some summary content` and `<out-dir>/post.details.html` with content `Here are some details`.

XML parsing happens after the edge template has been rendered,
so not only can the content inside `<file>` tags be dynamic, we can also dynamically add `<file>` tags too.

So the following is legal:

```xml
@each (post in posts)
<file path="post/{{post.slug}}/summary.html">
{{post.title}} - by {{post.author}}
</file>
<file path="post/{{post.slug}}/details.html">
{{post.body}}
</file>
@end
```

(final output must be valid XML)

It is possible to dedent and trim the content through attributes in the file tag:

```xml
<file path="post/summary.html" trim="true" dedent="true">
</file>
```

## Use cases

This is intended to be a minimal utility that simplifies tasks like below for JS/TS developers comfortable with CLI:

- Building static sites
- Knowledge-graphs
- Code generation
- Using edge.js from other languages

## Motivations

If you don't care about cross-language support, edgejs is easier than Handlebars/mustache/liquid etc.
because the embedded expressions are plain JS - so there is less need to learn custom syntax specific
to the templating language, and we also have first class support for async.

Also, unlike JSX based solutions, it is more versatile because it is not limited to HTML

---

:warning: This project has nothing to do with Microsoft edge browser.
