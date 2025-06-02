import Link from 'next/link';
import { HelpCircle, BookOpen, Brain, Users, Target, Zap, ArrowRight, Sparkles } from 'lucide-react';

export default function ExplorationsPage() {
  const explorationTools = [
    {
      id: 'question-solver',
      title: 'Past Questions',
      description: 'Practice with past exam questions collaboratively with Carson. Upload your question banks and work through them with AI-powered explanations.',
      icon: HelpCircle,
      href: '/question-solver',
      status: 'available',
      features: ['Split-screen interface', 'Real-time discussions', 'Upload question banks', 'Detailed explanations']
    },
    {
      id: 'case-studies',
      title: 'Interactive Case Studies',
      description: 'Work through complex medical cases with Carson guiding your clinical reasoning and decision-making process.',
      icon: Brain,
      href: '/case-studies',
      status: 'coming-soon',
      features: ['Clinical reasoning', 'Differential diagnosis', 'Treatment planning', 'Patient management']
    },
    {
      id: 'group-learning',
      title: 'Group Study Sessions',
      description: 'Join collaborative learning sessions with other medical students, facilitated by Carson.',
      icon: Users,
      href: '/group-sessions',
      status: 'coming-soon',
      features: ['Peer collaboration', 'Group discussions', 'Shared problem solving', 'Team-based learning']
    },
    {
      id: 'skill-builder',
      title: 'Clinical Skills Builder',
      description: 'Practice clinical procedures and skills with step-by-step guidance and feedback from Carson.',
      icon: Target,
      href: '/skills',
      status: 'coming-soon',
      features: ['Procedure guidance', 'Skill assessment', 'Progress tracking', 'Competency building']
    },
    {
      id: 'quick-review',
      title: 'Quick Review Sessions',
      description: 'Rapid-fire review sessions for high-yield topics, perfect for last-minute exam preparation.',
      icon: Zap,
      href: '/quick-review',
      status: 'coming-soon',
      features: ['High-yield topics', 'Rapid recall', 'Spaced repetition', 'Exam focused']
    }
  ];

  return (
    <div className="flex-1 overflow-auto bg-gray-50 dark:bg-gray-900">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 py-8 sm:py-12">
        {/* Header */}
        <div className="text-center mb-12 sm:mb-16">
          <div className="inline-flex items-center gap-2 sm:gap-3 bg-white dark:bg-gray-800 px-4 sm:px-6 py-2 sm:py-3 rounded-full shadow-sm border border-gray-200 dark:border-gray-700 mb-6 sm:mb-8">
            <BookOpen className="w-5 h-5 sm:w-6 sm:h-6 text-blue-600 dark:text-blue-400" />
            <span className="text-base sm:text-lg font-semibold text-gray-900 dark:text-white">Explorations</span>
          </div>
          <h1 className="text-3xl sm:text-4xl lg:text-5xl font-bold text-gray-900 dark:text-white mb-4 sm:mb-6 leading-tight px-4">
            Advanced Learning Tools
          </h1>
          <p className="text-lg sm:text-xl text-gray-600 dark:text-gray-300 max-w-4xl mx-auto leading-relaxed px-4">
            Discover interactive experiences designed to enhance your medical education journey with Carson. 
            From collaborative question solving to clinical case studies.
          </p>
        </div>

        {/* Available Tool - Featured */}
        <div className="mb-8 sm:mb-12">
          <div className="bg-gradient-to-br from-blue-500 to-blue-600 dark:from-blue-600 dark:to-blue-700 rounded-xl sm:rounded-2xl p-6 sm:p-8 text-white relative overflow-hidden">
            <div className="absolute top-0 right-0 w-24 h-24 sm:w-32 sm:h-32 bg-white/10 rounded-full -translate-y-12 translate-x-12 sm:-translate-y-16 sm:translate-x-16"></div>
            <div className="absolute bottom-0 left-0 w-16 h-16 sm:w-24 sm:h-24 bg-white/10 rounded-full translate-y-8 -translate-x-8 sm:translate-y-12 sm:-translate-x-12"></div>
            
            <div className="relative">
              <div className="flex items-center gap-2 sm:gap-3 mb-3 sm:mb-4">
                <HelpCircle className="w-6 h-6 sm:w-8 sm:h-8" />
                <span className="bg-green-500 text-green-50 px-2 sm:px-3 py-1 rounded-full text-xs sm:text-sm font-medium">
                  Available Now
                </span>
              </div>
              
              <h2 className="text-2xl sm:text-3xl font-bold mb-3 sm:mb-4">Past Questions Solver</h2>
              <p className="text-blue-100 dark:text-blue-200 text-base sm:text-lg mb-4 sm:mb-6 max-w-3xl">
                Practice with past exam questions collaboratively with Carson. Upload your question banks and work through them with AI-powered explanations in a split-screen interface.
              </p>
              
              <div className="flex flex-wrap gap-2 sm:gap-3 mb-6 sm:mb-8">
                {['Split-screen interface', 'Real-time discussions', 'Upload question banks', 'Detailed explanations'].map((feature) => (
                  <span key={feature} className="bg-white/20 backdrop-blur-sm px-2 sm:px-3 py-1 rounded-full text-xs sm:text-sm">
                    {feature}
                  </span>
                ))}
              </div>
              
              <Link
                href="/question-solver"
                className="inline-flex items-center gap-2 bg-white text-blue-600 px-6 sm:px-8 py-3 sm:py-4 rounded-lg sm:rounded-xl font-semibold hover:bg-blue-50 dark:hover:bg-gray-100 transition-colors group"
              >
                Start Practicing
                <ArrowRight className="w-4 h-4 sm:w-5 sm:h-5 group-hover:translate-x-1 transition-transform" />
              </Link>
            </div>
          </div>
        </div>

        {/* Coming Soon Tools */}
        <div className="mb-12 sm:mb-16">
          <div className="text-center mb-8 sm:mb-12">
            <div className="inline-flex items-center gap-2 text-gray-600 dark:text-gray-400 mb-3 sm:mb-4">
              <Sparkles className="w-4 h-4 sm:w-5 sm:h-5" />
              <span className="font-medium text-sm sm:text-base">Coming Soon</span>
            </div>
            <h2 className="text-2xl sm:text-3xl font-bold text-gray-900 dark:text-white mb-3 sm:mb-4 px-4">More Tools in Development</h2>
            <p className="text-gray-600 dark:text-gray-400 max-w-2xl mx-auto px-4">
              We're building additional interactive learning experiences to help you master medical concepts.
            </p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 sm:gap-6 lg:gap-8">
            {explorationTools.slice(1).map((tool) => {
              const IconComponent = tool.icon;
              
              return (
                <div
                  key={tool.id}
                  className="bg-white dark:bg-gray-800 rounded-xl sm:rounded-2xl p-6 sm:p-8 border border-gray-200 dark:border-gray-700 hover:shadow-lg transition-all duration-200 hover:border-gray-300 dark:hover:border-gray-600 group"
                >
                  <div className="bg-gray-50 dark:bg-gray-700 p-3 sm:p-4 rounded-lg sm:rounded-xl mb-4 sm:mb-6 group-hover:bg-gray-100 dark:group-hover:bg-gray-600 transition-colors">
                    <IconComponent className="w-6 h-6 sm:w-8 sm:h-8 text-gray-600 dark:text-gray-300" />
                  </div>

                  <h3 className="text-lg sm:text-xl font-semibold text-gray-900 dark:text-white mb-2 sm:mb-3">
                    {tool.title}
                  </h3>
                  
                  <p className="text-gray-600 dark:text-gray-400 mb-4 sm:mb-6 leading-relaxed text-sm sm:text-base">
                    {tool.description}
                  </p>

                  <div className="space-y-1.5 sm:space-y-2 mb-6 sm:mb-8">
                    {tool.features.map((feature, index) => (
                      <div key={index} className="flex items-center gap-2 sm:gap-3 text-xs sm:text-sm text-gray-600 dark:text-gray-400">
                        <div className="w-1 h-1 sm:w-1.5 sm:h-1.5 bg-blue-500 dark:bg-blue-400 rounded-full flex-shrink-0"></div>
                        {feature}
                      </div>
                    ))}
                  </div>

                  <div className="bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800 rounded-lg sm:rounded-xl px-3 sm:px-4 py-2 sm:py-3 text-center">
                    <span className="text-yellow-700 dark:text-yellow-400 font-medium text-xs sm:text-sm">Coming Soon</span>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Bottom CTA */}
        <div className="bg-white dark:bg-gray-800 rounded-xl sm:rounded-2xl p-8 sm:p-12 text-center border border-gray-200 dark:border-gray-700">
          <div className="max-w-3xl mx-auto">
            <h2 className="text-2xl sm:text-3xl font-bold text-gray-900 dark:text-white mb-3 sm:mb-4 px-4">
              Building the Future of Medical Education
            </h2>
            <p className="text-lg sm:text-xl text-gray-600 dark:text-gray-400 mb-6 sm:mb-8 leading-relaxed px-4">
              Our team is constantly developing new ways to enhance your learning experience. 
              Stay tuned for more interactive tools, collaborative features, and AI-powered learning experiences.
            </p>
            <div className="flex items-center justify-center gap-2 text-gray-500 dark:text-gray-400">
              <Sparkles className="w-4 h-4 sm:w-5 sm:h-5" />
              <span className="font-medium text-sm sm:text-base">More exciting features coming your way</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
} 