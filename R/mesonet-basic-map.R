# Script builds the leaflet based map widget
# sources the base map from base_map.R
# adds points to the map representing station location with popups to station pages
# Author: Zach Hoylman - zachary.hoylman@mso.umt.edu

library(leaflet)
library(RCurl)
library(tidyverse)

setwd('/home/zhoylman/mesonet-dashboard')
git.dir = '/home/zhoylman/mesonet-dashboard'

row_to_popup <- function(name, station, sub_network) {
  paste0(
    '<div style="text-align:center"> <font size="3"> Station: ',
    name,
    " (",
    sub_network,
    ")",
    "<br> <a href='https://mesonet.climate.umt.edu/dash/",
    station,
    "' target='blank'>View Current Data</a> <br> <a href='https://shiny.cfc.umt.edu/mesonet-download/' target='blank'>Mesonet Data Downloader</a> </font>"
  ) %>%
    paste(collapse = '<hr>')
}

stations_raw <-
  getURL(
    'https://mesonet.climate.umt.edu/api/v2/stations/?type=csv&clean=true&active=True'
  ) %>%
  read_csv()

stations <- stations_raw %>%
  dplyr::group_by(latitude, longitude) %>%
  dplyr::summarise(
    name = list(name),
    station = list(station),
    sub_network = list(sub_network),
    collocated = ifelse(dplyr::n() > 1, TRUE, FALSE)
  ) %>%
  dplyr::rowwise() %>%
  dplyr::transmute(
    pop = row_to_popup(unlist(name), unlist(station), unlist(sub_network)),
    latitude = latitude,
    longitude = longitude,
    name = paste0(unlist(name), ' (', unlist(sub_network), ')', collapse = ', '),
    # Still need to figure out how to replace the html.
    # name = ifelse(length(name) > 1, stringr::str_replace(stringr::fixed("<br> <a href='https://shiny.cfc.umt.edu/mesonet-download/' target='blank'>Mesonet Data Downloader</a>"), ''), name),
    sub_network = ifelse(collocated, 'collocated', unlist(sub_network)),
    color = dplyr::case_when(
      sub_network == 'AgriMet' ~ "blue",
      sub_network == 'collocated' ~ "red",
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
      colors = c('blue', 'green', 'red'),
      labels = c(
        'AgriMet',
        "HydroMet",
        'Collocated<br>&emsp;&ensp;&nbsp;(AgriMet/HydroMet)'
      )
    )
}

map = base_map() %>%
  add_station_layer(stations, radius = 6, weight = 2) %>%
  add_radar_layer_and_controls() %>%
  add_leaflet_legend()

htmlwidgets::saveWidget(
  map,
  paste0(git.dir, "/data/simple_map/simple_mesonet_map.html"),
  selfcontained = F,
  libdir = "./libs"
)

station_list <- stations_raw %>%
  dplyr::transmute(
    lname = paste0(name, ' (', sub_network, ')'),
    href = paste0(
      'https://mesonet.climate.umt.edu/dash/',
      station
    )
  ) %>% 
  dplyr::arrange(lname)


registerPlugin <- function(map, plugin) {
  map$dependencies <- c(map$dependencies, list(plugin))
  map
}

map_home = base_map() %>%
  registerPlugin(jquerylib::jquery_core()) %>%
  add_station_layer(stations, radius = 10, weight = 4) %>%
  add_radar_layer_and_controls() %>%
  leaflet::setView(lng = -109.5,
                   lat = 47,
                   zoom = 6) %>%
  add_leaflet_legend() %>%
  htmlwidgets::onRender("
    function(el, x, data) {
      var selector = L.control({
        position: 'topright'
      })
      
      selector.onAdd = function(map) {
        var div = L.DomUtil.create('select', 'info legend dropdown');
        return div
      }
      
      selector.addTo(this)
      
      $('select').empty()
      for (var i = 0; i < data.lname.length; i++) {
        var lname = data.lname[i];
        var link = data.href[i] 
        
        $('select')
          .append($('<option>', {
            value: link
          }).text(lname))
      }
      // changed to open new window
      $('select').change(function() {
        window.open($('select').val())
      })
    }               
  ", data = station_list)


htmlwidgets::saveWidget(
  map_home,
  paste0(git.dir, "/data/simple_map/simple_mesonet_map_home.html"),
  selfcontained = F,
  libdir = "./libs"
)
