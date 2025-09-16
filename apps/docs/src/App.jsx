import { useState, useEffect } from 'react'
import { AnimatePresence } from 'framer-motion'
import { Button } from '@/components/ui/button.jsx'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card.jsx'
import { Badge } from '@/components/ui/badge.jsx'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs.jsx'
import { 
  Code2, 
  Zap, 
  Puzzle, 
  BarChart3, 
  Terminal, 
  Download, 
  Github,
  ArrowRight,
  CheckCircle,
  Star,
  Layers,
  Target,
  Gauge,
  FileText,
  Sparkles,
  ChevronDown,
  Play
} from 'lucide-react'
import spaguettiScopeLogo from './assets/spaguettiscope_logo.png'
import './App.css'

function App() {
  const [_activeSection, setActiveSection] = useState('hero')
  const [isVisible, setIsVisible] = useState({})

  useEffect(() => {
    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          setIsVisible(prev => ({
            ...prev,
            [entry.target.id]: entry.isIntersecting
          }))
          if (entry.isIntersecting) {
            setActiveSection(entry.target.id)
          }
        })
      },
      { threshold: 0.3 }
    )

    document.querySelectorAll('section[id]').forEach((section) => {
      observer.observe(section)
    })

    return () => observer.disconnect()
  }, [])

  const fadeInUp = {
    initial: { opacity: 0, y: 60 },
    animate: { opacity: 1, y: 0 },
    transition: { duration: 0.6, ease: "easeOut" }
  }

  const staggerChildren = {
    animate: {
      transition: {
        staggerChildren: 0.1
      }
    }
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50 to-indigo-100 dark:from-slate-900 dark:via-slate-800 dark:to-slate-900">
      {/* Navigation */}
      <nav className="fixed top-0 w-full bg-white/80 dark:bg-slate-900/80 backdrop-blur-md border-b border-slate-200 dark:border-slate-700 z-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center h-16">
            <div className="flex items-center space-x-3">
              <img src={spaguettiScopeLogo} alt="SpaguettiScope" className="h-8 w-8" />
              <span className="text-xl font-bold bg-gradient-to-r from-blue-600 to-purple-600 bg-clip-text text-transparent">
                SpaguettiScope
              </span>
            </div>
            <div className="hidden md:flex items-center space-x-8">
              <a href="#features" className="text-slate-600 hover:text-blue-600 transition-colors">Features</a>
              <a href="#demo" className="text-slate-600 hover:text-blue-600 transition-colors">Demo</a>
              <a href="#docs" className="text-slate-600 hover:text-blue-600 transition-colors">Docs</a>
              <a href="#plugins" className="text-slate-600 hover:text-blue-600 transition-colors">Plugins</a>
              <Button variant="outline" size="sm">
                <Github className="h-4 w-4 mr-2" />
                GitHub
              </Button>
            </div>
          </div>
        </div>
      </nav>

      {/* Hero Section */}
      <section id="hero" className="pt-24 pb-20 px-4 sm:px-6 lg:px-8">
        <div className="max-w-7xl mx-auto">
          <motion.div 
            className="text-center"
            initial="initial"
            animate="animate"
            variants={staggerChildren}
          >
            <motion.div variants={fadeInUp} className="mb-8">
              <img 
                src={spaguettiScopeLogo} 
                alt="SpaguettiScope Logo" 
                className="h-24 w-24 mx-auto mb-6"
              />
              <h1 className="text-5xl md:text-7xl font-bold mb-6">
                <span className="bg-gradient-to-r from-blue-600 via-purple-600 to-cyan-600 bg-clip-text text-transparent">
                  SpaguettiScope
                </span>
              </h1>
              <p className="text-xl md:text-2xl text-slate-600 dark:text-slate-300 mb-4">
                Framework-Agnostic Code Entropy Analyzer
              </p>
              <p className="text-lg text-slate-500 dark:text-slate-400 max-w-2xl mx-auto">
                Cool but serious. Built for developers who care about code quality.
              </p>
            </motion.div>

            <motion.div variants={fadeInUp} className="mb-12">
              <div className="flex flex-col sm:flex-row gap-4 justify-center items-center">
                <Button size="lg" className="bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700">
                  <Download className="h-5 w-5 mr-2" />
                  Get Started
                </Button>
                <Button variant="outline" size="lg">
                  <Play className="h-5 w-5 mr-2" />
                  Watch Demo
                </Button>
              </div>
            </motion.div>

            <motion.div variants={fadeInUp} className="grid grid-cols-1 md:grid-cols-3 gap-6 max-w-4xl mx-auto">
              <Card className="border-0 shadow-lg bg-white/60 dark:bg-slate-800/60 backdrop-blur-sm">
                <CardContent className="p-6 text-center">
                  <Gauge className="h-12 w-12 mx-auto mb-4 text-blue-600" />
                  <h3 className="text-lg font-semibold mb-2">Entropy Scoring</h3>
                  <p className="text-slate-600 dark:text-slate-300">
                    6-dimensional entropy analysis with actionable insights
                  </p>
                </CardContent>
              </Card>
              
              <Card className="border-0 shadow-lg bg-white/60 dark:bg-slate-800/60 backdrop-blur-sm">
                <CardContent className="p-6 text-center">
                  <Puzzle className="h-12 w-12 mx-auto mb-4 text-purple-600" />
                  <h3 className="text-lg font-semibold mb-2">Plugin Architecture</h3>
                  <p className="text-slate-600 dark:text-slate-300">
                    Framework-agnostic core with extensible plugin system
                  </p>
                </CardContent>
              </Card>
              
              <Card className="border-0 shadow-lg bg-white/60 dark:bg-slate-800/60 backdrop-blur-sm">
                <CardContent className="p-6 text-center">
                  <Terminal className="h-12 w-12 mx-auto mb-4 text-cyan-600" />
                  <h3 className="text-lg font-semibold mb-2">Beautiful CLI</h3>
                  <p className="text-slate-600 dark:text-slate-300">
                    Gorgeous terminal interface with gradients and animations
                  </p>
                </CardContent>
              </Card>
            </motion.div>
          </motion.div>
        </div>
      </section>

      {/* Features Section */}
      <section id="features" className="py-20 px-4 sm:px-6 lg:px-8 bg-white/50 dark:bg-slate-800/50">
        <div className="max-w-7xl mx-auto">
          <motion.div 
            className="text-center mb-16"
            initial={{ opacity: 0, y: 30 }}
            animate={isVisible.features ? { opacity: 1, y: 0 } : {}}
            transition={{ duration: 0.6 }}
          >
            <h2 className="text-4xl font-bold mb-4">
              <span className="bg-gradient-to-r from-blue-600 to-purple-600 bg-clip-text text-transparent">
                Why SpaguettiScope?
              </span>
            </h2>
            <p className="text-xl text-slate-600 dark:text-slate-300 max-w-3xl mx-auto">
              Unlike other code analysis tools, SpaguettiScope provides deep entropy insights 
              with a framework-agnostic architecture that scales to any codebase.
            </p>
          </motion.div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-12 items-center">
            <motion.div
              initial={{ opacity: 0, x: -50 }}
              animate={isVisible.features ? { opacity: 1, x: 0 } : {}}
              transition={{ duration: 0.6, delay: 0.2 }}
            >
              <h3 className="text-2xl font-bold mb-6">Sophisticated Analysis Engine</h3>
              <div className="space-y-4">
                <div className="flex items-start space-x-3">
                  <CheckCircle className="h-6 w-6 text-green-500 mt-0.5" />
                  <div>
                    <h4 className="font-semibold">Multi-Dimensional Entropy</h4>
                    <p className="text-slate-600 dark:text-slate-300">
                      Analyzes complexity, boundaries, redundancy, bundle size, hotspots, and coverage
                    </p>
                  </div>
                </div>
                <div className="flex items-start space-x-3">
                  <CheckCircle className="h-6 w-6 text-green-500 mt-0.5" />
                  <div>
                    <h4 className="font-semibold">Framework Agnostic</h4>
                    <p className="text-slate-600 dark:text-slate-300">
                      Core engine works with any framework through intelligent plugin system
                    </p>
                  </div>
                </div>
                <div className="flex items-start space-x-3">
                  <CheckCircle className="h-6 w-6 text-green-500 mt-0.5" />
                  <div>
                    <h4 className="font-semibold">Actionable Recommendations</h4>
                    <p className="text-slate-600 dark:text-slate-300">
                      Prioritized suggestions that actually help improve code quality
                    </p>
                  </div>
                </div>
              </div>
            </motion.div>

            <motion.div
              initial={{ opacity: 0, x: 50 }}
              animate={isVisible.features ? { opacity: 1, x: 0 } : {}}
              transition={{ duration: 0.6, delay: 0.4 }}
              className="bg-slate-900 rounded-lg p-6 text-green-400 font-mono text-sm overflow-hidden"
            >
              <div className="mb-4">
                <span className="text-blue-400">$</span> spasco analyze . --plugin=nextjs --verbose
              </div>
              <div className="space-y-2">
                <div className="text-cyan-400">📊 Project Overview:</div>
                <div className="ml-4 space-y-1">
                  <div>Files           42</div>
                  <div>Lines of Code   2,847</div>
                  <div>Components      8</div>
                  <div>Routes          5</div>
                </div>
                <div className="mt-4 p-4 border border-green-500 rounded">
                  <div className="text-center">
                    <div className="text-2xl font-bold text-green-400">1.1/10.0</div>
                    <div className="text-green-300">EXCELLENT</div>
                  </div>
                </div>
                <div className="text-yellow-400">🎯 Recommendations:</div>
                <div className="ml-4">
                  <div>1. ⚡ MED Increase test coverage [testing]</div>
                </div>
              </div>
            </motion.div>
          </div>
        </div>
      </section>

      {/* Demo Section */}
      <section id="demo" className="py-20 px-4 sm:px-6 lg:px-8">
        <div className="max-w-7xl mx-auto">
          <motion.div 
            className="text-center mb-16"
            initial={{ opacity: 0, y: 30 }}
            animate={isVisible.demo ? { opacity: 1, y: 0 } : {}}
            transition={{ duration: 0.6 }}
          >
            <h2 className="text-4xl font-bold mb-4">
              <span className="bg-gradient-to-r from-purple-600 to-cyan-600 bg-clip-text text-transparent">
                See It In Action
              </span>
            </h2>
            <p className="text-xl text-slate-600 dark:text-slate-300 max-w-3xl mx-auto">
              Experience the power of SpaguettiScope with interactive demos and real-world examples.
            </p>
          </motion.div>

          <Tabs defaultValue="cli" className="max-w-4xl mx-auto">
            <TabsList className="grid w-full grid-cols-3">
              <TabsTrigger value="cli">CLI Demo</TabsTrigger>
              <TabsTrigger value="report">HTML Report</TabsTrigger>
              <TabsTrigger value="plugins">Plugin System</TabsTrigger>
            </TabsList>
            
            <TabsContent value="cli" className="mt-8">
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center">
                    <Terminal className="h-5 w-5 mr-2" />
                    Beautiful Command Line Interface
                  </CardTitle>
                  <CardDescription>
                    Experience the gorgeous terminal output with gradients, animations, and color-coded results.
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="bg-slate-900 rounded-lg p-6 text-green-400 font-mono text-sm">
                    <div className="mb-4 text-center">
                      <div className="text-2xl font-bold bg-gradient-to-r from-cyan-400 to-purple-400 bg-clip-text text-transparent">
                        SPAGUETTISCOPE
                      </div>
                      <div className="text-slate-400">Framework-agnostic code entropy analyzer</div>
                      <div className="text-slate-400">Cool but serious. Built for developers.</div>
                    </div>
                    <div className="space-y-2">
                      <div><span className="text-blue-400">✅</span> Using NextJS plugin</div>
                      <div><span className="text-yellow-400">⠋</span> Scanning files...</div>
                      <div><span className="text-green-400">✔</span> Analysis complete!</div>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </TabsContent>
            
            <TabsContent value="report" className="mt-8">
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center">
                    <FileText className="h-5 w-5 mr-2" />
                    Interactive HTML Reports
                  </CardTitle>
                  <CardDescription>
                    Generate beautiful, shareable reports with detailed insights and visualizations.
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="bg-white rounded-lg border p-6">
                    <div className="text-center mb-6">
                      <h3 className="text-2xl font-bold">SpaguettiScope Analysis Report</h3>
                      <p className="text-slate-600">Generated on {new Date().toLocaleDateString()}</p>
                    </div>
                    <div className="grid grid-cols-2 gap-6">
                      <div className="text-center">
                        <div className="text-4xl font-bold text-green-500">1.1/10.0</div>
                        <div className="text-green-600 font-semibold">EXCELLENT</div>
                      </div>
                      <div className="space-y-2">
                        <div className="flex justify-between">
                          <span>Complexity</span>
                          <span className="font-semibold">2.1</span>
                        </div>
                        <div className="flex justify-between">
                          <span>Boundaries</span>
                          <span className="font-semibold">1.8</span>
                        </div>
                        <div className="flex justify-between">
                          <span>Redundancy</span>
                          <span className="font-semibold">0.5</span>
                        </div>
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </TabsContent>
            
            <TabsContent value="plugins" className="mt-8">
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center">
                    <Puzzle className="h-5 w-5 mr-2" />
                    Extensible Plugin Architecture
                  </CardTitle>
                  <CardDescription>
                    Framework-specific knowledge through a powerful plugin system.
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="p-4 border rounded-lg">
                      <div className="flex items-center mb-2">
                        <Badge variant="secondary" className="mr-2">NextJS</Badge>
                        <span className="text-sm text-green-600">✓ Available</span>
                      </div>
                      <p className="text-sm text-slate-600">
                        App Router, Pages Router, API routes, server/client components
                      </p>
                    </div>
                    <div className="p-4 border rounded-lg opacity-60">
                      <div className="flex items-center mb-2">
                        <Badge variant="outline" className="mr-2">Remix</Badge>
                        <span className="text-sm text-slate-500">Coming Soon</span>
                      </div>
                      <p className="text-sm text-slate-600">
                        Remix routes, loaders, actions, nested routing
                      </p>
                    </div>
                    <div className="p-4 border rounded-lg opacity-60">
                      <div className="flex items-center mb-2">
                        <Badge variant="outline" className="mr-2">Astro</Badge>
                        <span className="text-sm text-slate-500">Coming Soon</span>
                      </div>
                      <p className="text-sm text-slate-600">
                        Astro components, islands, content collections
                      </p>
                    </div>
                    <div className="p-4 border rounded-lg opacity-60">
                      <div className="flex items-center mb-2">
                        <Badge variant="outline" className="mr-2">Vue/Nuxt</Badge>
                        <span className="text-sm text-slate-500">Coming Soon</span>
                      </div>
                      <p className="text-sm text-slate-600">
                        Vue components, Nuxt pages, composables
                      </p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </TabsContent>
          </Tabs>
        </div>
      </section>

      {/* Documentation Section */}
      <section id="docs" className="py-20 px-4 sm:px-6 lg:px-8 bg-white/50 dark:bg-slate-800/50">
        <div className="max-w-7xl mx-auto">
          <motion.div 
            className="text-center mb-16"
            initial={{ opacity: 0, y: 30 }}
            animate={isVisible.docs ? { opacity: 1, y: 0 } : {}}
            transition={{ duration: 0.6 }}
          >
            <h2 className="text-4xl font-bold mb-4">
              <span className="bg-gradient-to-r from-green-600 to-blue-600 bg-clip-text text-transparent">
                Get Started
              </span>
            </h2>
            <p className="text-xl text-slate-600 dark:text-slate-300 max-w-3xl mx-auto">
              Everything you need to start analyzing your codebase with SpaguettiScope.
            </p>
          </motion.div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
            <Card className="hover:shadow-lg transition-shadow">
              <CardHeader>
                <CardTitle className="flex items-center">
                  <Zap className="h-5 w-5 mr-2 text-yellow-500" />
                  Quick Start
                </CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-slate-600 dark:text-slate-300 mb-4">
                  Get up and running with SpaguettiScope in minutes.
                </p>
                <div className="bg-slate-100 dark:bg-slate-800 rounded p-3 font-mono text-sm">
                  <div>npm install -g spaguettiscope</div>
                  <div>spasco analyze . --plugin=nextjs</div>
                </div>
              </CardContent>
            </Card>

            <Card className="hover:shadow-lg transition-shadow">
              <CardHeader>
                <CardTitle className="flex items-center">
                  <Code2 className="h-5 w-5 mr-2 text-blue-500" />
                  API Reference
                </CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-slate-600 dark:text-slate-300 mb-4">
                  Complete API documentation for core engine and plugins.
                </p>
                <Button variant="outline" size="sm">
                  View API Docs
                  <ArrowRight className="h-4 w-4 ml-2" />
                </Button>
              </CardContent>
            </Card>

            <Card className="hover:shadow-lg transition-shadow">
              <CardHeader>
                <CardTitle className="flex items-center">
                  <Layers className="h-5 w-5 mr-2 text-purple-500" />
                  Plugin Development
                </CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-slate-600 dark:text-slate-300 mb-4">
                  Learn how to create plugins for your favorite frameworks.
                </p>
                <Button variant="outline" size="sm">
                  Plugin Guide
                  <ArrowRight className="h-4 w-4 ml-2" />
                </Button>
              </CardContent>
            </Card>
          </div>
        </div>
      </section>

      {/* Plugins Section */}
      <section id="plugins" className="py-20 px-4 sm:px-6 lg:px-8">
        <div className="max-w-7xl mx-auto">
          <motion.div 
            className="text-center mb-16"
            initial={{ opacity: 0, y: 30 }}
            animate={isVisible.plugins ? { opacity: 1, y: 0 } : {}}
            transition={{ duration: 0.6 }}
          >
            <h2 className="text-4xl font-bold mb-4">
              <span className="bg-gradient-to-r from-purple-600 to-pink-600 bg-clip-text text-transparent">
                Plugin Ecosystem
              </span>
            </h2>
            <p className="text-xl text-slate-600 dark:text-slate-300 max-w-3xl mx-auto">
              Extend SpaguettiScope with framework-specific plugins that understand your codebase.
            </p>
          </motion.div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-8 max-w-4xl mx-auto">
            <Card className="border-2 border-green-200 bg-green-50 dark:bg-green-900/20">
              <CardHeader>
                <div className="flex items-center justify-between">
                  <CardTitle className="flex items-center">
                    <Badge className="mr-2 bg-green-600">NextJS</Badge>
                    Available Now
                  </CardTitle>
                  <Star className="h-5 w-5 text-yellow-500" />
                </div>
              </CardHeader>
              <CardContent>
                <ul className="space-y-2 text-sm">
                  <li className="flex items-center">
                    <CheckCircle className="h-4 w-4 text-green-500 mr-2" />
                    App Router & Pages Router support
                  </li>
                  <li className="flex items-center">
                    <CheckCircle className="h-4 w-4 text-green-500 mr-2" />
                    Server vs Client component detection
                  </li>
                  <li className="flex items-center">
                    <CheckCircle className="h-4 w-4 text-green-500 mr-2" />
                    API routes and middleware analysis
                  </li>
                  <li className="flex items-center">
                    <CheckCircle className="h-4 w-4 text-green-500 mr-2" />
                    Test and Storybook integration
                  </li>
                </ul>
              </CardContent>
            </Card>

            <Card className="border-2 border-blue-200 bg-blue-50 dark:bg-blue-900/20">
              <CardHeader>
                <CardTitle className="flex items-center">
                  <Badge variant="outline" className="mr-2">Coming Soon</Badge>
                  More Frameworks
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="font-medium">Remix</span>
                    <Badge variant="secondary">Q1 2024</Badge>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="font-medium">Astro</span>
                    <Badge variant="secondary">Q1 2024</Badge>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="font-medium">Vue/Nuxt</span>
                    <Badge variant="secondary">Q2 2024</Badge>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="font-medium">Angular</span>
                    <Badge variant="secondary">Q2 2024</Badge>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section className="py-20 px-4 sm:px-6 lg:px-8 bg-gradient-to-r from-blue-600 to-purple-600">
        <div className="max-w-4xl mx-auto text-center">
          <motion.div
            initial={{ opacity: 0, y: 30 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6 }}
          >
            <h2 className="text-4xl font-bold text-white mb-6">
              Ready to Analyze Your Code?
            </h2>
            <p className="text-xl text-blue-100 mb-8 max-w-2xl mx-auto">
              Join developers who are already using SpaguettiScope to improve their code quality 
              and reduce technical debt.
            </p>
            <div className="flex flex-col sm:flex-row gap-4 justify-center">
              <Button size="lg" variant="secondary">
                <Download className="h-5 w-5 mr-2" />
                Download SpaguettiScope
              </Button>
              <Button size="lg" variant="outline" className="text-white border-white hover:bg-white hover:text-blue-600">
                <Github className="h-5 w-5 mr-2" />
                View on GitHub
              </Button>
            </div>
          </motion.div>
        </div>
      </section>

      {/* Footer */}
      <footer className="py-12 px-4 sm:px-6 lg:px-8 bg-slate-900 text-white">
        <div className="max-w-7xl mx-auto">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-8">
            <div>
              <div className="flex items-center space-x-3 mb-4">
                <img src={spaguettiScopeLogo} alt="SpaguettiScope" className="h-8 w-8" />
                <span className="text-xl font-bold">SpaguettiScope</span>
              </div>
              <p className="text-slate-400">
                Framework-agnostic code entropy analyzer. Cool but serious. Built for developers.
              </p>
            </div>
            <div>
              <h3 className="font-semibold mb-4">Product</h3>
              <ul className="space-y-2 text-slate-400">
                <li><a href="#features" className="hover:text-white transition-colors">Features</a></li>
                <li><a href="#demo" className="hover:text-white transition-colors">Demo</a></li>
                <li><a href="#plugins" className="hover:text-white transition-colors">Plugins</a></li>
              </ul>
            </div>
            <div>
              <h3 className="font-semibold mb-4">Documentation</h3>
              <ul className="space-y-2 text-slate-400">
                <li><a href="#docs" className="hover:text-white transition-colors">Getting Started</a></li>
                <li><a href="#" className="hover:text-white transition-colors">API Reference</a></li>
                <li><a href="#" className="hover:text-white transition-colors">Plugin Development</a></li>
              </ul>
            </div>
            <div>
              <h3 className="font-semibold mb-4">Community</h3>
              <ul className="space-y-2 text-slate-400">
                <li><a href="#" className="hover:text-white transition-colors">GitHub</a></li>
                <li><a href="#" className="hover:text-white transition-colors">Discord</a></li>
                <li><a href="#" className="hover:text-white transition-colors">Twitter</a></li>
              </ul>
            </div>
          </div>
          <div className="border-t border-slate-800 mt-8 pt-8 text-center text-slate-400">
            <p>&copy; 2024 SpaguettiScope. Built with ❤️ for developers.</p>
          </div>
        </div>
      </footer>
    </div>
  )
}

export default App

