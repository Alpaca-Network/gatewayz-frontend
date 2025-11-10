import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetTrigger } from "@/components/ui/sheet";
import { Menu } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import React from "react";

const Navigation = () => {
  const location = usePathname();
  const [scrolled, setScrolled] = React.useState(false);
  
  const navItems = [
    { name: "Home", path: "/" },
    { name: "About", path: "/about" },
    { name: "Pricing", path: "/pricing" },
    { name: "Documentation", path: "https://docs.gatewayz.ai/", external: true },
    { name: "Blog", path: "https://blog.gatewayz.ai", external: true },
    { name: "Contact", path: "/contact" },
  ];

  const isActive = (path: string) => location === path;
  const isHomePage = location === "/";

  React.useEffect(() => {
    const handleScroll = () => {
      setScrolled(window.scrollY > 20);
    };
    window.addEventListener("scroll", handleScroll);
    return () => window.removeEventListener("scroll", handleScroll);
  }, []);

  return (
    <nav className={`fixed top-0 left-0 right-0 z-50 bg-white border-b border-gray-200 transition-shadow duration-300 ${scrolled ? 'shadow-md' : ''}`}>
      <div className="container mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex justify-between items-center h-16">
          {/* Logo */}
          <Link href="/" className="flex items-center gap-3 group">
            <img 
              src="/gatewayz-logo-black.png" 
              alt="Gatewayz" 
              className="h-8 w-8 transition-transform group-hover:scale-105" 
            />
            <span className="text-lg font-semibold text-gray-900">Gatewayz</span>
          </Link>

          {/* Desktop Navigation */}
          <div className="hidden md:flex items-center gap-6">
            {isHomePage ? (
              <>
                <a
                  href="#features"
                  className="text-sm font-medium text-gray-600 hover:text-gray-900 transition-colors"
                >
                  Features
                </a>
                <a
                  href="#pricing"
                  className="text-sm font-medium text-gray-600 hover:text-gray-900 transition-colors"
                >
                  Pricing
                </a>
                <a
                  href="https://docs.gatewayz.ai/"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-sm font-medium text-gray-600 hover:text-gray-900 transition-colors"
                >
                  Documentation
                </a>
                <a
                  href="https://blog.gatewayz.ai"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-sm font-medium text-gray-600 hover:text-gray-900 transition-colors"
                >
                  Blog
                </a>
                <Link
                  href="/contact"
                  className="text-sm font-medium text-gray-600 hover:text-gray-900 transition-colors"
                >
                  Contact
                </Link>
                <div className="flex items-center gap-3 ml-2">
                  <Button variant="outline" asChild size="sm" className="h-9">
                    <a href="https://beta.gatewayz.ai">Try Now</a>
                  </Button>
                  <Button asChild size="sm" className="h-9 bg-indigo-600 hover:bg-indigo-700">
                    <a href="https://cal.com/vonalytics/gatewayz" target="_blank" rel="noopener noreferrer">Book Demo Call</a>
                  </Button>
                </div>
              </>
            ) : (
              <>
                {navItems.map((item) => (
                  item.external ? (
                    <a
                      key={item.path}
                      href={item.path}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-sm font-medium text-gray-600 hover:text-gray-900 transition-colors"
                    >
                      {item.name}
                    </a>
                  ) : (
                    <Link
                      key={item.path}
                      href={item.path}
                      className={`text-sm font-medium transition-colors ${
                        isActive(item.path)
                          ? "text-gray-900"
                          : "text-gray-600 hover:text-gray-900"
                      }`}
                    >
                      {item.name}
                    </Link>
                  )
                ))}
                <div className="flex items-center gap-3 ml-2">
                  <Button variant="outline" asChild size="sm" className="h-9">
                    <a href="https://beta.gatewayz.ai">Try Now</a>
                  </Button>
                  <Button asChild size="sm" className="h-9 bg-indigo-600 hover:bg-indigo-700">
                    <a href="https://cal.com/vonalytics/gatewayz" target="_blank" rel="noopener noreferrer">Book Demo Call</a>
                  </Button>
                </div>
              </>
            )}
          </div>

          {/* Mobile Navigation */}
          <Sheet>
            <SheetTrigger asChild className="md:hidden">
              <Button variant="ghost" size="sm" className="text-gray-900">
                <Menu className="h-5 w-5" />
              </Button>
            </SheetTrigger>
            <SheetContent side="right" className="w-64 bg-white border-gray-200">
              <div className="flex flex-col space-y-4 mt-8">
                {navItems.map((item) => (
                  item.external ? (
                    <a
                      key={item.path}
                      href={item.path}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-sm font-medium text-gray-600 hover:text-gray-900 transition-colors"
                    >
                      {item.name}
                    </a>
                  ) : (
                    <Link
                      key={item.path}
                      href={item.path}
                      className={`text-sm font-medium transition-colors ${
                        isActive(item.path)
                          ? "text-gray-900"
                          : "text-gray-600 hover:text-gray-900"
                      }`}
                    >
                      {item.name}
                    </Link>
                  )
                ))}
                <div className="flex flex-col gap-3 pt-2">
                  <Button variant="outline" asChild className="w-full">
                    <a href="https://beta.gatewayz.ai">Try Now</a>
                  </Button>
                  <Button asChild className="w-full bg-indigo-600 hover:bg-indigo-700">
                    <a href="https://cal.com/vonalytics/gatewayz" target="_blank" rel="noopener noreferrer">Book Demo Call</a>
                  </Button>
                </div>
              </div>
            </SheetContent>
          </Sheet>
        </div>
      </div>
    </nav>
  );
};

export default Navigation;
