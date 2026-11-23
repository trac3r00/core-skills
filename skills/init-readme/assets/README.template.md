<!-- Optional: existing logo or hero image only. Remove this block if the repository has none. -->
<p align="center">
  <img src="<relative path to existing image>" alt="<what the image shows>" width="<px>">
</p>

# <name fact from the parent: manifest name, else Git remote name, else directory name>

**<One bold sentence: what it is and who it is for.>** <Optional plain sentence saying what it is not.>

<!-- Each badge only when its fact is not `absent` and its link target exists. -->
[![release](https://img.shields.io/badge/release-<version>-<color>)](<CHANGELOG.md>)
[![license](https://img.shields.io/badge/license-<SPDX>-blue)](<LICENSE>)
<!-- Add a CI badge only if a workflow exists: [![ci](<workflow badge url>)](<workflow url>) -->

<!-- Table of contents: include only when the file exceeds 250 lines.
## Contents
- [Why](#why)
- [Requirements](#requirements)
- [Install](#install)
- [Quick start](#quick-start)
- [Usage](#usage)
- [Configuration](#configuration)
- [How it works](#how-it-works)
- [Development](#development)
- [Contributing](#contributing)
- [License](#license)
-->

## Why

<The problem, in the user's terms, in one short paragraph. Then the outcome this project gives them.>

| Area | Feature | What you get |
| --- | --- | --- |
| <area> | **<feature>** | <outcome in one sentence> <!-- E<n> --> |

## Requirements

- <runtime> <minimum version> <!-- E<n> -->
- <OS or platform constraint, if any>
- <external service or account, marked optional when it is>

## Install

```<shell or language tag>
<shortest install command; must be a `run`, exit-0 entry in commands.md> <!-- C<n> -->
```

<One sentence on what the command did and where things landed.>

<Alternative install path, if one exists, under a short bold lead-in.>

## Quick start

```<tag>
<the single smallest command or snippet that proves it works>
```

<Expected output or observable result, short and stable.>

## Usage

### <User task 1>

<Goal in one sentence.>

```<tag>
<command or code>
```

<What happens.>

### <User task 2>

...

## Configuration

| Key | Default | Effect | Where |
| --- | --- | --- | --- |
| `<key>` | `<default from code>` | <effect> | `<file path>` <!-- E<n> --> |

<Precedence order when more than one source exists: flags > environment > file > defaults, or whatever the code does.>

## How it works

<One paragraph. Then a module table or a text diagram for multi-module projects.>

| Module | Purpose | Read first |
| --- | --- | --- |
| `<dir>` | <one line> | `<file>` |

## Development

```<tag>
<clone>
<dev install>
<build>
<test>
<lint / typecheck>
```

<Release procedure, if contributors run it, as a link or short list.>

## Troubleshooting

- **<Symptom>**: <cause and fix, with a link to the issue or code path>.

## Contributing

<Link to CONTRIBUTING.md, or two sentences on issues, PRs, and the checks that must pass.>

## License

<SPDX name>. See [LICENSE](<LICENSE>).

## Acknowledgments

- <upstream project or bundled third-party work, with its license>
