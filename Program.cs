using System;
using System.Web;

using System.Collections.Generic;
using System.IO;
using System.Linq;
using System.Net;
using System.Threading.Tasks;
using Microsoft.AspNetCore;
using Microsoft.AspNetCore.Hosting;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.Logging;

namespace signalr_aspnetcore
{
    public class Program
    {
        public static void Main(string[] args)
        {
            var url = $"http://*:{Environment.GetEnvironmentVariable("PORT")}/";

            Console.WriteLine($"Using Url: {url}");
#if DEBUG
            //Console.WriteLine("Debug");
            BuildWebHost(args).Run();
#else
            Console.WriteLine("Releae");
            var host = new WebHostBuilder()
                .UseKestrel()
                .UseContentRoot(Directory.GetCurrentDirectory())
                .UseIISIntegration()
                .UseStartup<Startup>()
                .UseUrls(url)
                .Build();

            host.Run();
#endif

        }
#if DEBUG
        public static IWebHost BuildWebHost(string[] args) =>
    WebHost.CreateDefaultBuilder(args)
        .UseStartup<Startup>()
        .UseUrls("http://localhost:9999")
        .UseIISIntegration()
        .UseKestrel()
        .Build();
#endif
    }
}
