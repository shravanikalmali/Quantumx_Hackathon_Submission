import React from "react";
import { Tabs } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { Platform } from "react-native";
import { C } from "../../lib/constants";

const TAB_ICON = {
  home:      { active: "home",         inactive: "home-outline"         },
  account:   { active: "person-circle", inactive: "person-circle-outline" },
  // Hidden tabs (still need to be registered so expo-router doesn't complain)
  incidents: { active: "list",         inactive: "list-outline"         },
  report:    { active: "alert-circle", inactive: "alert-circle-outline" },
  teams:     { active: "shield",       inactive: "shield-outline"       },
  responders:{ active: "medical",      inactive: "medical-outline"      },
  map:       { active: "map",          inactive: "map-outline"          },
};

function icon(name) {
  return ({ focused, color, size }) => {
    const n = focused ? TAB_ICON[name].active : TAB_ICON[name].inactive;
    return <Ionicons name={n} size={size} color={color} />;
  };
}

export default function TabLayout() {
  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor:   C.navActive,
        tabBarInactiveTintColor: C.navInactive,
        tabBarStyle: {
          backgroundColor: C.surface,
          borderTopColor:  C.border,
          borderTopWidth:  1,
          height:          Platform.OS === "ios" ? 82 : 64,
          paddingBottom:   Platform.OS === "ios" ? 24 : 8,
          paddingTop:      8,
        },
        tabBarLabelStyle: { fontSize: 11, fontWeight: "500" },
      }}
    >
      <Tabs.Screen name="home"       options={{ title: "Home",    tabBarIcon: icon("home")    }} />
      <Tabs.Screen name="account"    options={{ title: "Account", tabBarIcon: icon("account") }} />
      {/* Hidden tabs — keep registered but hide from tab bar */}
      <Tabs.Screen name="incidents"  options={{ href: null }} />
      <Tabs.Screen name="report"     options={{ href: null }} />
      <Tabs.Screen name="teams"      options={{ href: null }} />
      <Tabs.Screen name="responders" options={{ href: null }} />
      <Tabs.Screen name="map"        options={{ href: null }} />
    </Tabs>
  );
}
