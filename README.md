# SpaguettiScope

> Framework-agnostic code entropy analyzer for modern development teams

[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)
[![Node.js](https://img.shields.io/badge/node-%3E%3D18.0.0-brightgreen)](https://nodejs.org/)
[![pnpm](https://img.shields.io/badge/pnpm-%3E%3D8.0.0-blue)](https://pnpm.io/)

SpaguettiScope is a comprehensive code analysis tool that calculates entropy scores across six
dimensions to help development teams understand and improve their codebase health. Unlike
traditional static analysis tools, SpaguettiScope provides actionable insights through a beautiful
CLI interface and extensible plugin architecture.

## ✨ Features

- **🎯 Framework-Agnostic Core** - Works with any codebase through a plugin system
- **📊 6-Dimensional Entropy Analysis** - Complexity, boundaries, redundancy, bundle size, hotspots,
  and test coverage
- **🎨 Beautiful CLI Interface** - Gradient colors, interactive tables, and progress indicators
- **🔌 Plugin Architecture** - Extensible framework-specific analysis (NextJS included)
- **📈 Multiple Output Formats** - Terminal, JSON, and HTML reports
- **⚡ Fast Analysis** - Optimized for large codebases with intelligent caching

## 🚀 Quick Start

### Prerequisites

- Node.js 18.0.0 or higher
- pnpm 8.0.0 or higher

### Installation

```bash
# Clone the repository
git clone https://github.com/your-org/spaguettiscope.git
cd spaguettiscope

# Install dependencies
pnpm install

# Build packages
pnpm build
```

### Basic Usage

```bash
# Analyze a Next.js project
./packages/cli/bin/spasco.js analyze /path/to/project --plugin=nextjs

# Generate detailed HTML report
./packages/cli/bin/spasco.js report /path/to/project --plugin=nextjs --output=report.html

# List available plugins
./packages/cli/bin/spasco.js plugins

# Get help
./packages/cli/bin/spasco.js --help
```

## 📊 Entropy Scoring

SpaguettiScope calculates a weighted entropy score across six key dimensions:

| Dimension      | Weight | Description                                |
| -------------- | ------ | ------------------------------------------ |
| **Complexity** | 25%    | Cyclomatic and cognitive complexity        |
| **Boundaries** | 20%    | Architecture coupling and dependencies     |
| **Redundancy** | 15%    | Code duplication and unused code           |
| **Bundle**     | 15%    | Bundle size and optimization opportunities |
| **Hotspots**   | 15%    | Maintenance burden and code churn          |
| **Coverage**   | 10%    | Test and documentation coverage            |

### Score Classification

- **🟢 Excellent (0-3)** - Outstanding code health
- **🟡 Good (3-5)** - Minor improvements needed
- **🟠 Moderate (5-7)** - Some refactoring recommended
- **🔴 Poor (7-9)** - Significant technical debt
- **⚫ Critical (9-10)** - Immediate attention required

## 🏗️ Architecture

```
spaguettiscope/
├── packages/
│   ├── core/           # Framework-agnostic analysis engine
│   └── cli/            # Command-line interface
├── plugins/
│   └── nextjs/         # Next.js framework plugin
├── apps/
│   └── docs/           # Documentation website
└── examples/           # Example projects and configurations
```

## 🔌 Plugins

### Available Plugins

- **NextJS** - Comprehensive Next.js analysis with App Router and Pages Router support

### Creating Custom Plugins

```javascript
import { AnalyzerPlugin } from '@spaguettiscope/core'

export class MyFrameworkPlugin extends AnalyzerPlugin {
  constructor() {
    super('my-framework')
  }

  async canAnalyze(projectPath) {
    // Plugin detection logic
    return existsSync(join(projectPath, 'my-framework.config.js'))
  }

  async discover(projectPath, options) {
    // Framework-specific discovery
    return {
      files: [],
      routes: [],
      components: [],
      metadata: { framework: 'my-framework' },
    }
  }

  getFilePatterns() {
    return ['**/*.{js,jsx,ts,tsx}']
  }

  getIgnorePatterns() {
    return ['node_modules/**', 'dist/**']
  }
}
```

## 🛠️ Development

### Prerequisites

- Node.js 18+ with pnpm
- Git

### Setup

```bash
# Clone and install
git clone https://github.com/your-org/spaguettiscope.git
cd spaguettiscope
pnpm install

# Start development
pnpm dev

# Run tests
pnpm test

# Lint code
pnpm lint

# Build all packages
pnpm build
```

### Project Structure

- **`packages/core/`** - Core analysis engine
- **`packages/cli/`** - Command-line interface
- **`plugins/nextjs/`** - Next.js plugin
- **`apps/docs/`** - Documentation site

### Testing

```bash
# Run all tests
pnpm test

# Test specific package
cd packages/core && pnpm test

# Test with coverage
pnpm test:coverage
```

## 📈 Usage Examples

### Analyzing a Next.js Project

```bash
# Basic analysis
spasco analyze ./my-nextjs-app --plugin=nextjs

# Verbose output with detailed metrics
spasco analyze ./my-nextjs-app --plugin=nextjs --verbose

# Generate HTML report
spasco report ./my-nextjs-app --plugin=nextjs --output=analysis.html
```

### Sample Output

```
📊 Project Overview:

Files           42
Lines of Code   2,847
Components      12
Routes          8

┌─────────────────────────────────────────────────────────┐
│                                                         │
│   ENTROPY SCORE                                         │
│                                                         │
│   2.3/10.0                                             │
│   GOOD                                                  │
│                                                         │
└─────────────────────────────────────────────────────────┘

🎯 Recommendations:

1. ⚡ HIGH Reduce complexity in ProductList component
   Cyclomatic complexity of 18 detected. Consider breaking into smaller functions.
   → maintainability

2. 🔧 MED Improve test coverage
   Only 65% of components have associated tests.
   → reliability
```

## 🤝 Contributing

We welcome contributions! Please see our [Contributing Guide](CONTRIBUTING.md) for details.

### Ways to Contribute

- 🐛 **Bug Reports** - Report issues via GitHub Issues
- 💡 **Feature Requests** - Suggest new features or improvements
- 🔌 **New Plugins** - Add support for additional frameworks
- 📚 **Documentation** - Improve docs and examples
- 🧪 **Testing** - Add test cases and improve coverage

### Development Workflow

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/amazing-feature`)
3. Make your changes
4. Add tests for new functionality
5. Ensure all tests pass (`pnpm test`)
6. Commit with conventional commits (`git commit -m 'feat: add amazing feature'`)
7. Push to your branch (`git push origin feature/amazing-feature`)
8. Open a Pull Request

## 📄 License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## 🙏 Acknowledgments

- Built with [TypeScript](https://www.typescriptlang.org/) and [Node.js](https://nodejs.org/)
- CLI powered by [Commander.js](https://github.com/tj/commander.js/)
- Beautiful terminal output with [Chalk](https://github.com/chalk/chalk) and
  [Ora](https://github.com/sindresorhus/ora)
- Code parsing with [@typescript-eslint/parser](https://typescript-eslint.io/)
- Monorepo managed with [Turborepo](https://turbo.build/) and [pnpm](https://pnpm.io/)

## 🔗 Links

- [Documentation](https://spaguettiscope.dev)
- [Plugin Development Guide](docs/plugins.md)
- [API Reference](docs/api.md)
- [Examples](examples/)

---

<div align="center">

**[SpaguettiScope](https://spaguettiscope.dev)** - Untangle your code, one analysis at a time.

</div>
