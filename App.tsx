import React, { useState, useEffect, useRef } from 'react';
import { 
  Scissors, 
  CheckCircle2, 
  Clock, 
  Users, 
  Menu, 
  X, 
  Instagram, 
  ArrowRight,
  MessageCircle,
} from 'lucide-react';

const Reveal: React.FC<{ children?: React.ReactNode, delay?: number }> = ({ children, delay = 0 }) => {
  const [isVisible, setIsVisible] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setIsVisible(true);
          observer.unobserve(entry.target);
        }
      },
      { threshold: 0.1 }
    );
    if (ref.current) observer.observe(ref.current);
    return () => { if (ref.current) observer.unobserve(ref.current); };
  }, []);

  return (
    <div 
      ref={ref} 
      className={`transition-all duration-1000 ease-out ${
        isVisible ? "opacity-100 translate-y-0" : "opacity-0 translate-y-10"
      }`}
      style={{ transitionDelay: `${delay}ms` }}
    >
      {children}
    </div>
  );
};

const SectionTitle = ({ children, subtitle }: { children?: React.ReactNode, subtitle?: string }) => (
  <Reveal>
    <div className="text-center mb-10 md:mb-16">
      {subtitle && <span className="text-xs font-bold tracking-[0.4em] text-blue-500 uppercase mb-3 block">{subtitle}</span>}
      <h2 className="text-4xl md:text-5xl lg:text-6xl font-bold text-white leading-tight">{children}</h2>
      <div className="w-20 h-1 bg-blue-600 mx-auto mt-6"></div>
    </div>
  </Reveal>
);

const Navbar = () => {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  useEffect(() => {
    const handleResize = () => {
      if (window.innerWidth >= 768) {
        setMobileMenuOpen(false);
      }
    };
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  useEffect(() => {
    document.body.style.overflow = mobileMenuOpen ? 'hidden' : 'unset';
  }, [mobileMenuOpen]);

  const menuItems = [
    { name: 'Início', id: 'inicio' },
    { name: 'Sobre', id: 'sobre' },
    { name: 'Qualidade', id: 'qualidade' },
    { name: 'Serviços', id: 'servicos' },
    { name: 'Contato', id: 'contato' },
  ];

  const handleLinkClick = (e: React.MouseEvent<HTMLAnchorElement>, id: string) => {
    e.preventDefault();
    setMobileMenuOpen(false);
    
    setTimeout(() => {
      const element = document.getElementById(id);
      if (element) {
        const offset = 80;
        const elementPosition = element.getBoundingClientRect().top;
        const offsetPosition = elementPosition + window.scrollY - offset;
        window.scrollTo({
          top: offsetPosition,
          behavior: 'smooth'
        });
      }
    }, 100);
  };

  return (
    <>
      <nav className="fixed w-full z-[100] bg-black/90 backdrop-blur-md border-b border-zinc-800 py-4">
        <div className="container mx-auto px-6 flex justify-between items-center relative">
          <div 
            className="flex items-center group cursor-pointer" 
            onClick={() => {
              setMobileMenuOpen(false);
              window.scrollTo({top: 0, behavior: 'smooth'});
            }}
          >
            <img 
              src="/img/logo.png" 
              alt="Quik uniformes Logo" 
              className="h-24 w-auto transform group-hover:scale-105 transition-transform" 
            />
          </div>

          <div className="hidden md:flex space-x-10 items-center">
            {menuItems.map((item) => (
              <a 
                key={item.name} 
                href={`#${item.id}`} 
                onClick={(e) => handleLinkClick(e, item.id)}
                className="text-xs font-bold text-zinc-400 hover:text-white transition-colors uppercase tracking-widest"
              >
                {item.name}
              </a>
            ))}
          </div>

          <button 
            className="md:hidden text-white p-2 focus:outline-none" 
            onClick={() => setMobileMenuOpen(true)}
          >
            <Menu size={32} />
          </button>
        </div>
      </nav>

      <div 
        className={`md:hidden fixed inset-0 w-full h-screen bg-black z-[150] flex flex-col transition-all duration-500 ease-in-out ${
          mobileMenuOpen ? 'opacity-100 translate-x-0' : 'opacity-0 translate-x-full pointer-events-none'
        }`}
      >
        <button 
          onClick={() => setMobileMenuOpen(false)}
          className="absolute top-6 right-6 text-white p-2 hover:bg-zinc-900 rounded-full transition-colors"
          aria-label="Fechar menu"
        >
          <X size={40} />
        </button>

        <div className="flex flex-col w-full pt-24 px-8">
          {menuItems.map((item, index) => (
            <a 
              key={item.name} 
              href={`#${item.id}`} 
              onClick={(e) => handleLinkClick(e, item.id)}
              className={`w-full py-6 text-2xl font-bold text-white uppercase tracking-widest border-b border-zinc-900 transition-all duration-700 ${
                mobileMenuOpen ? 'translate-y-0 opacity-100' : 'translate-y-10 opacity-0'
              }`}
              style={{ transitionDelay: `${index * 50}ms` }}
            >
              {item.name}
            </a>
          ))}
        </div>
      </div>
    </>
  );
};

const Hero = () => {
  const handleCtaClick = (e: React.MouseEvent<HTMLAnchorElement>) => {
    e.preventDefault();
    const element = document.getElementById('servicos');
    if (element) {
      const offset = 80;
      const elementPosition = element.getBoundingClientRect().top;
      const offsetPosition = elementPosition + window.scrollY - offset;
      window.scrollTo({
        top: offsetPosition,
        behavior: 'smooth'
      });
    }
  };

  return (
    <section id="inicio" className="relative min-h-screen flex flex-col justify-center overflow-hidden bg-black">
      <div className="absolute top-0 right-0 w-full md:w-1/2 h-full bg-gradient-to-l from-blue-900/10 to-transparent opacity-50"></div>
      
      <div className="container mx-auto px-6 grid grid-cols-1 lg:grid-cols-2 gap-12 md:gap-20 items-center relative z-10 pt-44 pb-20 md:pt-48 md:pb-32">
        <div className="text-center md:text-left">
          <div className="animate-slide-up">
            <h1 className="text-5xl md:text-7xl lg:text-8xl font-bold text-white leading-[1.1] mb-8">
              Uniformes com <span className="italic font-serif text-blue-500 underline decoration-zinc-800">qualidade.</span>
            </h1>
          </div>
          <div className="animate-slide-up [animation-delay:200ms]">
            <p className="text-lg md:text-2xl text-zinc-400 mb-10 max-w-xl mx-auto md:mx-0 leading-relaxed">
              A Quik uniformes oferece soluções práticas e duráveis em uniformes. Focamos na eficiência da entrega e na excelência do produto final para sua empresa ou negócio.
            </p>
          </div>
          <div className="animate-slide-up [animation-delay:400ms] flex justify-center md:justify-start">
            <a 
              href="#servicos" 
              onClick={handleCtaClick}
              className="bg-white text-black w-full md:w-auto px-10 py-5 rounded-lg font-bold flex items-center justify-center space-x-3 hover:bg-blue-600 hover:text-white transition-all group text-lg"
            >
              <span>VER SERVIÇOS</span>
              <ArrowRight size={24} className="group-hover:translate-x-1 transition-transform" />
            </a>
          </div>
        </div>
        
        <div className="relative animate-fade-in [animation-delay:600ms]">
          <div className="relative z-10 w-full h-[350px] sm:h-[450px] md:h-[600px] overflow-hidden rounded-2xl shadow-2xl border border-zinc-800 bg-zinc-900">
            <img 
              src="/img/img1.jpg" 
              alt="Confecção de Uniformes" 
              className="w-full h-full object-cover grayscale-[20%] hover:grayscale-0 transition-all duration-700"
            />
          </div>
          <div className="absolute -bottom-10 -left-10 w-64 h-64 bg-blue-600/20 blur-3xl animate-pulse"></div>
        </div>
      </div>
      <style>{`
        @keyframes slide-up {
          from { opacity: 0; transform: translateY(40px); }
          to { opacity: 1; transform: translateY(0); }
        }
        @keyframes fade-in {
          from { opacity: 0; }
          to { opacity: 1; }
        }
        .animate-slide-up { animation: slide-up 0.8s ease-out both; }
        .animate-fade-in { animation: fade-in 1s ease-out both; }
      `}</style>
    </section>
  );
};

const AboutSection = () => {
  return (
    <section id="sobre" className="py-20 md:py-32 bg-zinc-950 border-t border-zinc-900 overflow-hidden scroll-mt-20">
      <div className="container mx-auto px-6">
        <div className="grid lg:grid-cols-2 gap-16 md:gap-20 items-center">
          <Reveal>
            <div className="aspect-square overflow-hidden rounded-2xl border border-zinc-800 bg-zinc-900 group relative">
               <img 
                src="/img/img2.jpg" 
                alt="Tecidos de qualidade" 
                className="w-full h-full object-cover group-hover:scale-105 transition-all duration-1000"
              />
              <div className="absolute inset-0 bg-blue-900/10 mix-blend-multiply"></div>
            </div>
          </Reveal>
          
          <Reveal delay={200}>
            <div className="text-center md:text-left">
              <span className="text-xs font-bold tracking-[0.4em] text-blue-500 uppercase mb-6 block">Sobre Nós</span>
              <h2 className="text-4xl md:text-6xl font-bold text-white mb-8 italic font-serif leading-tight">Eficiência em cada etapa.</h2>
              <div className="space-y-6 text-zinc-400 leading-relaxed text-lg md:text-xl">
              <p>
                A Quik Uniformes é dedicada a oferecer produtos de alta qualidade, sempre priorizando excelência, cuidado nos detalhes e satisfação dos clientes.
              </p>
              <p>
                Nossa fundadora possui mais de 10 anos de experiência no mercado, trazendo conhecimento, compromisso e visão estratégica para entregar soluções confiáveis e um atendimento próximo e eficiente.
              </p>
              </div>
            </div>
          </Reveal>
        </div>
      </div>
    </section>
  );
};

const QualitySection = () => {
  const features = [
    { icon: <Scissors className="text-blue-500" size={40} />, title: "Agilidade", desc: "Produção otimizada para prazos curtos." },
    { icon: <CheckCircle2 className="text-blue-500" size={40} />, title: "Qualidade", desc: "Acabamento impecável em cada costura." },
    { icon: <Clock className="text-blue-500" size={40} />, title: "Pontualidade", desc: "Entrega rigorosa no dia combinado." },
    { icon: <Users className="text-blue-500" size={40} />, title: "Parceria", desc: "Atendimento próximo e personalizado." }
  ];

  return (
    <section id="qualidade" className="py-20 md:py-32 bg-black scroll-mt-20">
      <div className="container mx-auto px-6">
        <SectionTitle subtitle="Diferenciais">Padrão de Excelência</SectionTitle>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-8 md:gap-10">
          {features.map((f, i) => (
            <Reveal key={i} delay={i * 100}>
              <div className="p-10 h-full bg-zinc-900/30 border border-zinc-800 hover:border-blue-600 transition-all group rounded-2xl flex flex-col items-center sm:items-start">
                <div className="mb-6 transform group-hover:scale-110 transition-transform">{f.icon}</div>
                <h3 className="text-2xl font-bold mb-4 text-white uppercase text-center sm:text-left">{f.title}</h3>
                <p className="text-zinc-500 text-lg leading-relaxed text-center sm:text-left">{f.desc}</p>
              </div>
            </Reveal>
          ))}
        </div>
      </div>
    </section>
  );
};

const ServicesSection = () => {
  const items = [
    { title: "Corporativo", cat: "Business", img: "/img/img4.png" },
    { title: "Pequenos Negócios", cat: "Comércio & MEI", img: "/img/img6.png" },
    { title: "Outros", cat: "Diversos", img: "/img/img5.png" }
  ];

  return (
    <section id="servicos" className="py-20 md:py-32 bg-zinc-950 scroll-mt-20">
      <div className="container mx-auto px-6">
        <SectionTitle subtitle="Categorias">Nossas Soluções</SectionTitle>
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 md:gap-12">
          {items.map((item, i) => (
            <Reveal key={i} delay={i * 150}>
              <div className="relative h-[450px] sm:h-[550px] md:h-[600px] overflow-hidden group rounded-2xl border border-zinc-900 shadow-xl">
                <img src={item.img} alt={item.title} className="w-full h-full object-cover grayscale-[30%] group-hover:grayscale-0 group-hover:scale-110 transition-all duration-1000" />
                <div className="absolute inset-0 bg-gradient-to-t from-black via-black/40 to-transparent"></div>
                <div className="absolute bottom-0 left-0 p-8 md:p-12 transform group-hover:-translate-y-2 transition-transform">
                  <span className="text-[10px] font-bold text-blue-500 uppercase tracking-[0.4em] mb-3 block">{item.cat}</span>
                  <h3 className="text-2xl md:text-4xl font-bold text-white uppercase tracking-tighter">{item.title}</h3>
                </div>
              </div>
            </Reveal>
          ))}
        </div>
      </div>
    </section>
  );
};

const ContactSection = () => {
  return (
    <section id="contato" className="py-20 md:py-32 bg-black border-t border-zinc-900 scroll-mt-20">
      <div className="container mx-auto px-6">
        <div className="max-w-5xl mx-auto">
          <SectionTitle subtitle="Contato">Fale conosco</SectionTitle>
          <div className="max-w-5xl mx-auto">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 md:gap-8">
              <Reveal delay={100}>
                <a href="https://wa.me/5513991900224" target="_blank" rel="noopener noreferrer" className="bg-zinc-950 p-12 border border-zinc-800 rounded-2xl flex flex-col items-center text-center group hover:border-blue-500 transition-all h-full">
                  <MessageCircle className="text-blue-500 mb-6 group-hover:scale-110 transition-transform" size={56} />
                  <h5 className="font-bold text-2xl mb-2 text-white uppercase">WhatsApp</h5>
                  <p className="text-zinc-500 text-sm tracking-widest">+55 13 99190-0224</p>
                </a>
              </Reveal>
              <Reveal delay={200}>
                <a href="https://instagram.com/quik_uni" target="_blank" rel="noopener noreferrer" className="bg-zinc-950 p-12 border border-zinc-800 rounded-2xl flex flex-col items-center text-center group hover:border-blue-500 transition-all h-full">
                  <Instagram className="text-blue-500 mb-6 group-hover:scale-110 transition-transform" size={56} />
                  <h5 className="font-bold text-2xl mb-2 text-white uppercase">Instagram</h5>
                  <p className="text-zinc-500 text-sm tracking-widest">@quik_uni</p>
                </a>
              </Reveal>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
};

const App: React.FC = () => {
  return (
    <div className="min-h-screen bg-black text-white selection:bg-blue-600 selection:text-white overflow-x-hidden">
      <Navbar />
      <main>
        <Hero />
        <AboutSection />
        <QualitySection />
        <ServicesSection />
        <ContactSection />
      </main>
      
      <div className="fixed bottom-6 right-6 z-[100] md:bottom-10 md:right-10">
        <a 
          href="https://wa.me/5513991900224" 
          target="_blank" 
          rel="noopener noreferrer"
          className="bg-blue-600 p-4 md:p-5 rounded-full shadow-2xl hover:bg-blue-500 transition-all hover:scale-110 active:scale-95 block border border-white/20"
        >
          <MessageCircle size={32} className="text-white" />
        </a>
      </div>
    </div>
  );
};

export default App;