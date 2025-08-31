import { Button } from './button';

interface HeroProps {
  title: string;
  subtitle: string;
  description: string;
  primaryCta: {
    text: string;
    href: string;
  };
  secondaryCta?: {
    text: string;
    href: string;
  };
}

export function Hero({ title, subtitle, description, primaryCta, secondaryCta }: HeroProps) {
  return (
    <div className="relative overflow-hidden">
      {/* Animated background */}
      <div className="absolute inset-0 bg-gradient-to-br from-slate-900 via-purple-900 to-indigo-900">
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_center,_var(--tw-gradient-stops))] from-cyan-500/10 via-transparent to-transparent"></div>
        <div className="absolute inset-0 bg-[conic-gradient(from_0deg,transparent,rgba(120,119,198,0.1),transparent)] animate-spin" style={{animationDuration: '20s'}}></div>
      </div>
      
      {/* Floating particles */}
      <div className="absolute inset-0 overflow-hidden">
        <div className="absolute top-1/4 left-1/4 w-2 h-2 bg-cyan-400/30 rounded-full animate-pulse"></div>
        <div className="absolute top-1/3 right-1/4 w-1 h-1 bg-purple-400/40 rounded-full animate-bounce" style={{animationDelay: '2s'}}></div>
        <div className="absolute bottom-1/3 left-1/3 w-3 h-3 bg-pink-400/20 rounded-full animate-ping" style={{animationDelay: '1s'}}></div>
        <div className="absolute bottom-1/4 right-1/3 w-1 h-1 bg-cyan-300/50 rounded-full animate-pulse" style={{animationDelay: '3s'}}></div>
        <div className="absolute top-1/2 left-1/5 w-2 h-2 bg-indigo-400/30 rounded-full animate-bounce" style={{animationDelay: '4s'}}></div>
      </div>
      
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-32 relative z-10">
        <div className="text-center">
          {/* AI Badge */}
          <div className="inline-block px-6 py-3 bg-gradient-to-r from-cyan-500/10 to-purple-500/10 rounded-full border border-cyan-500/20 mb-8 backdrop-blur-sm">
            <span className="text-cyan-300 text-sm font-medium">
              ✨ Powered by Advanced AI • GPT-4 & Azure Intelligence
            </span>
          </div>
          
          <h1 className="text-5xl md:text-7xl font-bold bg-gradient-to-r from-white via-cyan-100 to-purple-100 bg-clip-text text-transparent mb-6 animate-in fade-in slide-in-from-bottom-4 duration-1000">
            {title}
          </h1>
          
          <p className="text-2xl md:text-3xl bg-gradient-to-r from-cyan-200 to-purple-200 bg-clip-text text-transparent mb-8 animate-in fade-in slide-in-from-bottom-8 duration-1000 delay-300">
            {subtitle}
          </p>
          
          <p className="text-lg text-gray-300 mb-12 max-w-4xl mx-auto leading-relaxed animate-in fade-in slide-in-from-bottom-12 duration-1000 delay-500">
            {description}
          </p>
          
          <div className="flex flex-col sm:flex-row gap-6 justify-center animate-in fade-in slide-in-from-bottom-16 duration-1000 delay-700">
            <a href={primaryCta.href}>
              <Button 
                size="lg" 
                className="bg-gradient-to-r from-cyan-500 to-purple-600 hover:from-cyan-400 hover:to-purple-500 text-white border-0 px-10 py-4 text-lg font-medium shadow-2xl hover:shadow-cyan-500/25 transition-all duration-300 transform hover:scale-105"
              >
                {primaryCta.text}
              </Button>
            </a>
            {secondaryCta && (
              <a href={secondaryCta.href}>
                <Button 
                  variant="outline" 
                  size="lg" 
                  className="border-2 border-cyan-400/30 text-cyan-100 hover:bg-cyan-400/10 hover:border-cyan-300 px-10 py-4 text-lg backdrop-blur-sm transition-all duration-300 transform hover:scale-105"
                >
                  {secondaryCta.text}
                </Button>
              </a>
            )}
          </div>
        </div>
      </div>
      
      {/* Bottom gradient fade */}
      <div className="absolute bottom-0 left-0 right-0 h-32 bg-gradient-to-t from-slate-900 to-transparent"></div>
    </div>
  );
}