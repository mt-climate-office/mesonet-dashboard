# Script to build the "meta table" for each station
# the "meta table" defines the site specific information such as location, name etc. 
# this table does not change often, can be considered static
# Author: Zach Hoylman - zachary.hoylman@mso.umt.edu 

library(RCurl) 
library(tidyverse) 
library(kableExtra)

stations = getURL('https://mesonet.climate.umt.edu/api/v2/stations/?type=csv&clean=true') %>%
  read_csv()

for(s in 1:length(stations$`station`)){
  stations %>%
    filter(`station` == stations$`station`[s]) %>% 
    t() %>%
    kable(., "html")%>%
    kable_styling(bootstrap_options = c("striped", "hover", "condensed", "responsive"))%>%
    save_kable(file = paste0("/home/zhoylman/mesonet-dashboard/data/station_page/latest_table/",stations$`station`[s],"_meta_table.html"),  self_contained = F, libdir = "./libs")
}
