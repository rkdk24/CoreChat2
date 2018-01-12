using System;
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
            //Console.WriteLine(request.isSecure());
            Console.WriteLine($"Using Url: {url}");

            var host = new WebHostBuilder()
                .UseKestrel()
                .UseContentRoot(Directory.GetCurrentDirectory())
                .UseIISIntegration()
                .UseStartup<Startup>()
                .UseUrls(url)
                .Build();

            host.Run();
            //BuildWebHost(args).Run();
        }

        //public static IWebHost BuildWebHost(string[] args) =>
        //    WebHost.CreateDefaultBuilder(args)
        //        .UseStartup<Startup>()
        //        .Build();
    //    public static IWebHost BuildWebHost(string[] args) =>
    //WebHost.CreateDefaultBuilder(args)
    //    .UseStartup<Startup>()
    //    .UseUrls("http://ancient-shelf-70200.herokuapp.com:57597")
    //    .UseIISIntegration()
    //    //.UseKestrel(options =>
    //    //{
    //    //    options.Listen(IPAddress.Loopback, 5000);

    //    //}
    //    .UseKestrel()
    //    .Build();
    }
}
