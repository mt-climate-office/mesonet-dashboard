# Script builds the leaflet based map widget
# sources the base map from base_map.R
# adds points to the map representing station location with popups to station pages
# Author: Zach Hoylman - zachary.hoylman@mso.umt.edu

library(leaflet)
library(RCurl)
library(tidyverse)

setwd('/home/zhoylman/')

row_to_popup <- function(name, station, sub_network) {
  paste0(
    '<div style="text-align:center"> <font size="3"> Station: ' ,
    name,
    " (",
    sub_network,
    ")",
    "<br> <a href='https://mco.cfc.umt.edu/mesonet_data/station_page/",
    station,
    ".html' target='blank'>View Current Data</a> <br> <a href='https://shiny.cfc.umt.edu/mesonet-download/' target='blank'>Mesonet Data Downloader</a> </font>"
  ) %>%
    paste(collapse = '<hr>')
}

stations <-
  getURL(
    'https://mesonet.climate.umt.edu/api/v2/stations/?type=csv&clean=true&active=True'
  ) %>%
  read_csv() %>%
  dplyr::group_by(latitude, longitude) %>%
  dplyr::summarise(
    name = list(name),
    station = list(station),
    sub_network = list(sub_network),
    colocated = ifelse(dplyr::n() > 1, TRUE, FALSE)
  ) %>%
  dplyr::rowwise() %>%
  dplyr::transmute(
    pop = row_to_popup(unlist(name), unlist(station), unlist(sub_network)),
    latitude = latitude,
    longitude = longitude,
    name = paste0(unlist(name), ' (', unlist(sub_network), ')', collapse = ', '),
    sub_network = ifelse(colocated, 'colocated', unlist(sub_network)),
    color = dplyr::case_when(
      sub_network == 'AgriMet' ~ "blue",
      sub_network == 'colocated' ~ "red",
      sub_network == 'HydroMet' ~ "green"
    )
  )

source("./R/base_map.R")


add_station_layer <- function(map_layer, stations, radius, weight) {
  map_layer %>% addCircleMarkers(
    data = stations,
    lat = ~ latitude,
    lng = ~ longitude,
    stroke = T,
    fillColor = ~ color,
    fillOpacity = 0.5,
    color = "black",
    opacity = 0.8,
    radius = radius,
    weight = weight,
    popup = ~ pop,
    label = ~ name,
    labelOptions = labelOptions(
      noHide = F,
      direction = "bottom",
      style = list("box-shadow" = "3px 3px rgba(0,0,0,0.25)",
                   "font-size" = "16px")
    )
  )
}

add_radar_layer_and_controls <- function(map_layer) {
  map_layer %>%
    leaflet::addWMSTiles(
      "https://mesonet.agron.iastate.edu/cgi-bin/wms/nexrad/n0r.cgi",
      group = "Radar",
      layers = "nexrad-n0r-900913",
      options = leaflet::WMSTileOptions(format = "image/png", transparent = TRUE)
    ) %>%
    leaflet::addLayersControl(
      position = "topleft",
      overlayGroups = c("Radar"),
      options = leaflet::layersControlOptions(collapsed = FALSE)
    )
}

add_leaflet_legend <- function(map_layer) {
  map_layer %>%
    addLegend(
      position = 'topright',
      colors = c('blue', 'red'),
      labels = c(
        'AgriMet',
        'Colocated<br>&emsp;&ensp;&nbsp;(AgriMet/HydroMet)'
      )
    )
}

map = base_map() %>%
  add_station_layer(stations, radius = 6, weight = 2) %>%
  add_radar_layer_and_controls() %>%
  add_leaflet_legend()

htmlwidgets::saveWidget(map, paste0("./data/simple_map/simple_mesonet_map.html"), selfcontained = F, libdir = "./libs")

map_home = base_map() %>% 
  add_station_layer(stations, radius = 10, weight = 4) %>%
  add_radar_layer_and_controls() %>% 
  leaflet::setView(lng = -109.5, lat = 47, zoom = 6) %>%
  add_leaflet_legend()

htmlwidgets::saveWidget(map_home, paste0("./data/simple_map/simple_mesonet_map_home.html"), selfcontained = F, libdir = "./libs")
