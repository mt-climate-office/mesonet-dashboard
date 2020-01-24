library(leaflet)
library(RCurl)
library(tidyverse)

setwd('/home/zhoylman/')

stations = getURL("https://mesonet.climate.umt.edu/api/stations?type=csv&clean=true") %>%
  read_csv()

source("/home/zhoylman/mesonet-dashboard/R/base_map.R")

map = base_map() %>% addCircleMarkers(data = stations, lat = ~Latitude, lng = ~Longitude, stroke = TRUE,
                                fillColor = "blue", fillOpacity = 0.5, color = "black", opacity = 0.8, radius = 6, weight = 2,
  popup = paste0('<font size="3"> ' ,stations$`Station name`,"<br> <a href='https://mco.cfc.umt.edu/mesonet_data/station_page/",stations$`Station ID`,".html' target='_blank'>Current Data</a> </font>")) %>%
  leaflet::addWMSTiles(
    "https://mesonet.agron.iastate.edu/cgi-bin/wms/nexrad/n0r.cgi", group = "Radar",
    layers = "nexrad-n0r-900913",
    options = leaflet::WMSTileOptions(format = "image/png", transparent = TRUE))%>%
  leaflet::addLayersControl(position = "topleft",
                            overlayGroups = c("Radar"),
                            options = leaflet::layersControlOptions(collapsed = FALSE))

htmlwidgets::saveWidget(map, paste0("/home/zhoylman/mesonet-dashboard/data/simple_map/simple_mesonet_map.html"), selfcontained = F, libdir = "./libs")
