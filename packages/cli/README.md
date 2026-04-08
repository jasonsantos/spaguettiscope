# @spaguettiscope/cli

CLI for SpaguettiScope — code topology and entropy analysis for monorepos.

## Try without installing

```bash
npx -p @spaguettiscope/cli spasco init
npx -p @spaguettiscope/cli spasco scan
npx -p @spaguettiscope/cli spasco dashboard
```

## Install globally

```bash
npm install -g @spaguettiscope/cli
```

## Commands

| Command                   | Description                                                              |
| ------------------------- | ------------------------------------------------------------------------ |
| `spasco init`             | Auto-detect tools and write `spasco.config.json`                         |
| `spasco scan`             | Scan files, build topology, propose dimension values                     |
| `spasco dashboard`        | Generate HTML dashboard with pass rates, coverage, entropy, and findings |
| `spasco analyze`          | Run analysis rules and compute entropy. Always exits 0.                  |
| `spasco check`            | CI gate — exits 1 on findings above severity or entropy above threshold  |
| `spasco annotate list`    | List skeleton entries with unresolved dimensions                         |
| `spasco annotate resolve` | Confirm or override proposed dimension values                            |

## Quick start

```bash
spasco init
spasco scan
spasco annotate resolve --as domain --all
spasco annotate resolve --as layer --all
spasco dashboard
```

See the [main repository](https://github.com/jasonsantos/spaguettiscope) for full documentation.
