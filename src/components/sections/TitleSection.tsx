export default function TitleSection() {
    return(
        <>
          <div className="space-y-2 md:space-y-4 px-4 mx-auto text-center">
            <h1 className="text-5xl md:text-6xl lg:text-7xl font-bold tracking-tight text-balance animate-fade-in-up opacity-0 delay-100">
                <span className="bg-gradient-to-r from-indigo-600 to-blue-600 bg-clip-text text-transparent">
                    Gatewayz:
                </span>
                <span className="text-gray-900 dark:text-white"> One API for Any AI Model</span>
            </h1>
              <p className="text-xl md:text-2xl text-gray-600 dark:text-gray-300 max-w-3xl mx-auto text-balance leading-relaxed animate-fade-in-up opacity-0 delay-200">
                Access 10,000+ AI models through one blazing-fast API. Lowest latency. Lowest cost.
              </p>
          </div>
        </>
    )
}