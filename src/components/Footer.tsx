export function Footer() {
  const currentYear = new Date().getFullYear();

  return (
    <footer className="border-t border-border/30 py-12 md:py-16">
      <div className="max-w-7xl mx-auto px-6">
        <div className="grid md:grid-cols-2 gap-8 mb-8">
          {/* Column 1: Brand */}
          <div>
            <h3 className="mb-4 font-semibold">WorkGraph</h3>
            <p className="text-sm text-muted-foreground m-0 leading-relaxed">
              Timesheets, approvals, and invoices across every company in the chain.
            </p>
          </div>

          {/* Column 2: Product */}
          <div>
            <h4 className="font-medium m-0 mb-4">Product</h4>
            <ul className="space-y-3 m-0 p-0 list-none">
              <li>
                <a href="#pricing" className="text-sm text-muted-foreground hover:text-foreground transition-colors">
                  Pricing
                </a>
              </li>
              <li>
                <a href="#faq" className="text-sm text-muted-foreground hover:text-foreground transition-colors">
                  FAQ
                </a>
              </li>
            </ul>
          </div>

        </div>

        {/* Bottom bar - cleaner */}
        <div className="pt-8 border-t border-border/30 flex flex-col md:flex-row justify-between items-center gap-4">
          <p className="text-xs text-muted-foreground m-0">
            © {currentYear} WorkGraph. All rights reserved.
          </p>
        </div>
      </div>
    </footer>
  );
}
