import { Link } from "react-router-dom";

export function Footer() {
  return (
    <footer className="border-t border-gray-200 py-12 px-4 sm:px-6 lg:px-8 bg-white">
      <div className="container mx-auto max-w-6xl">
        <div className="grid grid-cols-2 md:grid-cols-3 gap-8 mb-8">
          <div>
            <h3 className="font-semibold mb-4 text-gray-900">Product</h3>
            <ul className="space-y-2">
              <li>
                <a
                  href="#features"
                  className="text-sm text-gray-600 hover:text-gray-900 transition-colors"
                >
                  Features
                </a>
              </li>
              <li>
                <a href="#pricing" className="text-sm text-gray-600 hover:text-gray-900 transition-colors">
                  Pricing
                </a>
              </li>
              <li>
                <Link to="/docs" className="text-sm text-gray-600 hover:text-gray-900 transition-colors">
                  Documentation
                </Link>
              </li>
            </ul>
          </div>

          <div>
            <h3 className="font-semibold mb-4 text-gray-900">Resources</h3>
            <ul className="space-y-2">
              <li>
                <a 
                  href="https://blog.gatewayz.ai" 
                  target="_blank" 
                  rel="noopener noreferrer"
                  className="text-sm text-gray-600 hover:text-gray-900 transition-colors"
                >
                  Blog
                </a>
              </li>
            </ul>
          </div>

          <div>
            <h3 className="font-semibold mb-4 text-gray-900">Company</h3>
            <ul className="space-y-2">
              <li>
                <Link to="/about" className="text-sm text-gray-600 hover:text-gray-900 transition-colors">
                  About
                </Link>
              </li>
              <li>
                <Link to="/contact" className="text-sm text-gray-600 hover:text-gray-900 transition-colors">
                  Contact
                </Link>
              </li>
            </ul>
          </div>
        </div>

        <div className="pt-8 border-t border-gray-200 flex flex-col sm:flex-row justify-between items-center gap-4">
          <div className="flex items-center gap-2">
            <img 
              src="/gatewayz-logo-black.png" 
              alt="Gatewayz" 
              className="h-6 w-6" 
            />
            <span className="font-semibold text-gray-900">Gatewayz</span>
          </div>
          <p className="text-sm text-gray-600">© {new Date().getFullYear()} Augmented Intelligence Humans Inc. All rights reserved.</p>
        </div>
      </div>
    </footer>
  );
}
