# Function to build the HTML pages for each of the MT mesonet sites
# This functions builds R Markdown Documents with iframes for widgets
# mesonet-rebuild-rmd.R sources this function to rebuild all station pages
# Author: Zach Hoylman - zachary.hoylman@mso.umt.edu 

library(knitr)
library(RCurl)
library(dplyr)
library(tidyverse)

mesonet_build_rmd = function(lat, long, station_key, station_name){
  # define weather iframe
  weather_iframe = paste0('<iframe src="https://mobile.weather.gov/index.php?lat=',lat,'&lon=',long,'" height="680px" width="100%" frameborder="0"></iframe>')
  # define plotly data iframe (web)
  current_table_iframe = paste0('<iframe width="100%" height="300" allowfullscreen="allowfullscreen" target="_parent" allowvr="yes" frameborder="0" mozallowfullscreen="mozallowfullscreen" scrolling="yes" src="https://mco.cfc.umt.edu/mesonet_data/station_page/latest_table/', 
                                station_key,'_current_table.html" webkitallowfullscreen="webkitallowfullscreen"></iframe>')
  #define meta table
  meta_table_iframe = paste0('<iframe width="100%" height="300" allowfullscreen="allowfullscreen" target="_parent" allowvr="yes" frameborder="0" mozallowfullscreen="mozallowfullscreen" scrolling="yes" src="https://mco.cfc.umt.edu/mesonet_data/station_page/latest_table/', 
                                 station_key,'_meta_table.html" webkitallowfullscreen="webkitallowfullscreen"></iframe>')
  # define plotly data iframe (web)
  plotly_iframe = paste0('<iframe width="100%" height="1750px" allowfullscreen="allowfullscreen" allowvr="yes" frameborder="0" mozallowfullscreen="mozallowfullscreen" src="https://mco.cfc.umt.edu/mesonet_data/station_page/current_plots/',
                         station_key,'_current_data.html" webkitallowfullscreen="webkitallowfullscreen"></iframe>')
  # define plotly data iframe (mobile)
  plotly_mobile = paste0('<iframe width="110%" height="1750px" allowfullscreen="allowfullscreen" allowvr="yes" frameborder="0" mozallowfullscreen="mozallowfullscreen" src="https://mco.cfc.umt.edu/mesonet_data/station_page/current_plots/',
                         station_key,'_current_data.html" webkitallowfullscreen="webkitallowfullscreen"></iframe>')
  
  writeLines(paste0('---
title: "Montana Mesonet - ', station_name,'"
self_contained: true
output: 
  flexdashboard::flex_dashboard:
    self_contained: false
    lib_dir: "./libs"
    theme: spacelab
    css: css_modifier.css
    vertical_layout: scroll
    navbar:
      - { title: "Provide Feedback", href: "https://airtable.com/shrchV8wAec5R03Q9", align: right}
      - { title: "Mesonet Data Downloader", href: "https://shiny.cfc.umt.edu/mesonet-download", align: right }
      - { title: "Mesonet Map", href: "https://mesonet.climate.umt.edu/map", align: right }
      - { title: "MCO GitHub", href: "https://github.com/mt-climate-office", align: right }
    orientation: rows
---

<!-- Global site tag (gtag.js) - Google Analytics -->
<script async src="https://www.googletagmanager.com/gtag/js?id=UA-149859729-3"></script>
<script>
  window.dataLayer = window.dataLayer || [];
  function gtag(){dataLayer.push(arguments);}
  gtag("js", new Date());

  gtag("config", "UA-149859729-3");
</script>

Montana Mesonet {.sidebar data-width=350}
-------------------------------------
***
### {.no-mobile}
  
<img src="https://climate.umt.edu/imx/MCO_logo.svg" width="100%">

***

### Weather & Forecast {.no-mobile}
', weather_iframe,
'
Row {data-height=300}
-------------------------------------
### Station Information {.no-mobile}
  
', meta_table_iframe,
'

### Current Conditions {.no-mobile}
  
', current_table_iframe,
'
### Choose a Station  {.no-mobile}
  
<iframe width="100%" height="300" allowfullscreen="allowfullscreen" target="_parent" allowvr="yes" frameborder="0" mozallowfullscreen="mozallowfullscreen" scrolling="no" src="https://mco.cfc.umt.edu/mesonet_data/simple_map/simple_mesonet_map.html" webkitallowfullscreen="webkitallowfullscreen"></iframe>
  
Column {.tabset .tabset-fade data-height=1800}
-------------------------------------

### {.no-mobile data-height=1700}
', plotly_iframe,
'
### {.mobile .tabset .tabset-fade data-height=300}
', current_table_iframe,
'
### {.mobile .tabset .tabset-fade data-height=1700}
', plotly_mobile,
'
### {.mobile .tabset .tabset-fade data-height=300}
<iframe width="100%" height="300" allowfullscreen="allowfullscreen" target="_parent" allowvr="yes" frameborder="0" mozallowfullscreen="mozallowfullscreen" scrolling="no" src="https://mco.cfc.umt.edu/mesonet_data/simple_map/simple_mesonet_map.html" webkitallowfullscreen="webkitallowfullscreen"></iframe>
'),
             con = paste0("/home/zhoylman/mesonet-dashboard/data/station_page/", station_key, "temp.Rmd"))
  rmarkdown::render(paste0("/home/zhoylman/mesonet-dashboard/data/station_page/", station_key, "temp.Rmd"), output_file = paste0("/home/zhoylman/mesonet-dashboard/data/station_page/", station_key, ".html"), quiet=TRUE)
  file.remove(paste0("/home/zhoylman/mesonet-dashboard/data/station_page/", station_key, "temp.Rmd"))
}
