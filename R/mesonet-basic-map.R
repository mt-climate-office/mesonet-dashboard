# Script builds the leaflet based map widget
# sources the base map from base_map.R
# adds points to the map representing station location with popups to station pages
# Author: Zach Hoylman - zachary.hoylman@mso.umt.edu 

library(leaflet)
library(RCurl)
library(tidyverse)

setwd('/home/zhoylman/')

stations = getURL("https://mesonet.climate.umt.edu/api/stations?type=csv&clean=true") %>%
  read_csv()

source("/home/zhoylman/mesonet-dashboard/R/base_map.R")

map = base_map() %>% addCircleMarkers(data = stations, lat = ~Latitude, lng = ~Longitude, stroke = TRUE,
                                fillColor = "blue", fillOpacity = 0.5, color = "black", opacity = 0.8, radius = 6, weight = 2,
  popup = paste0('<font size="3"> ' ,stations$`Station name`,"<br> <a href='https://mco.cfc.umt.edu/mesonet_data/station_page/",stations$`Station ID`,".html' target='blank'>Current Data</a> </font>"),
  label = stations$`Station name`,
  labelOptions = labelOptions(noHide = F, direction = "bottom",
                              style = list(
                                "box-shadow" = "3px 3px rgba(0,0,0,0.25)",
                                "font-size" = "16px"
                              ))) %>%
  leaflet::addWMSTiles(
    "https://mesonet.agron.iastate.edu/cgi-bin/wms/nexrad/n0r.cgi", group = "Radar",
    layers = "nexrad-n0r-900913",
    options = leaflet::WMSTileOptions(format = "image/png", transparent = TRUE))%>%
  leaflet::addLayersControl(position = "topleft",
                            overlayGroups = c("Radar"),
                            options = leaflet::layersControlOptions(collapsed = FALSE))

htmlwidgets::saveWidget(map, paste0("/home/zhoylman/mesonet-dashboard/data/simple_map/simple_mesonet_map.html"), selfcontained = F, libdir = "./libs")

map_home = base_map() %>% addCircleMarkers(data = stations, lat = ~Latitude, lng = ~Longitude, stroke = TRUE,
                                      fillColor = "blue", fillOpacity = 0.5, color = "black", opacity = 0.8, radius = 10, weight = 4,
                                      popup = paste0('<font size="3"> ' ,stations$`Station name`,"<br> <a href='https://mco.cfc.umt.edu/mesonet_data/station_page/",stations$`Station ID`,".html' target='blank'>Current Data</a> </font>"),
                                      label = stations$`Station name`,
                                      labelOptions = labelOptions(noHide = F, direction = "bottom",
                                                                  style = list(
                                                                    "box-shadow" = "3px 3px rgba(0,0,0,0.25)",
                                                                    "font-size" = "16px"
                                                                  ))) %>%
  leaflet::addWMSTiles(
    "https://mesonet.agron.iastate.edu/cgi-bin/wms/nexrad/n0r.cgi", group = "Radar",
    layers = "nexrad-n0r-900913",
    options = leaflet::WMSTileOptions(format = "image/png", transparent = TRUE))%>%
  leaflet::addLayersControl(position = "topleft",
                            overlayGroups = c("Radar"),
                            options = leaflet::layersControlOptions(collapsed = FALSE)) %>%
  leaflet::setView(lng = -109.5, lat = 47, zoom = 6) 
  

htmlwidgets::saveWidget(map_home, paste0("/home/zhoylman/mesonet-dashboard/data/simple_map/simple_mesonet_map_home.html"), selfcontained = F, libdir = "./libs")
