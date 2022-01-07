# Script to rebuild all station pages
# This functions loops through each station and builds the assosiated station page 
# see build-rmd-function for function definition and additional annotation
# Author: Zach Hoylman - zachary.hoylman@mso.umt.edu 

source('/home/zhoylman/mesonet-dashboard/R/build-rmd-function.R')

stations = getURL('https://mesonet.climate.umt.edu/api/v2/stations/?type=csv&clean=true') %>%
  read_csv()

for(s in 1:length(stations$`station`)){
  mesonet_build_rmd(stations$latitude[s], stations$longitude[s], stations$`station`[s], stations$`name`[s])
}

