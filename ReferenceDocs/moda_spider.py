import scrapy, os
from scrapy.linkextractors import LinkExtractor
from scrapy.spiders import CrawlSpider, Rule

class ModaSpider(CrawlSpider):
    name = "moda_agent"
    allowed_domains = ["tmforum.org"]
    start_urls = ["https://www.tmforum.org/MODA/index.htm"]

    # CRITICAL: Only extract links that contain /MODA/ so it doesn't wander off
    rules = (
        Rule(
            LinkExtractor(allow=r'/MODA/'), 
            callback="parse_item", 
            follow=True
        ),
    )

    # Respectful scraping configuration
    custom_settings = {
        'DOWNLOAD_DELAY': 1.5,          # 1.5 second pause between pages
        'CONCURRENT_REQUESTS': 2,       # Don't overload the server
        'USER_AGENT': 'ModaDataAgent/1.0 (+http://yourdomain.com)'
    }

    def parse_item(self, response):
        # This will save the raw HTML of every page inside a JSON line file
        # Create a local directory named 'moda_pages' if it doesn't exist
        folder = 'moda_pages'
        if not os.path.exists(folder):
             os.makedirs(folder)
        
        # Generate a clean file name from the URL path
        filename = response.url.split("/")[-1]
        if not filename or filename.endswith('.htm') is False:
            filename = "index.html"
        
        # Save the raw HTML directly to your laptop's drive
        filepath = os.path.join(folder, filename)
        with open(filepath, 'wb') as f:
            f.write(response.body)
        
        self.log(f"Successfully saved file: {filepath}")
#        yield {
#           'url': response.url,
#           'title': response.css('title::text').get(),
#           'html': response.text
#       }




