import React, { createContext, useContext } from "react";
import { Stack } from "expo-router";
import { View } from "react-native";
import { StatusBar } from "expo-status-bar";
import { useIntelligence } from "../lib/hooks/useIntelligence";
import { C } from "../lib/constants";

export const IntelContext = createContext(null);
export const useIntel = () => useContext(IntelContext);

export default function RootLayout() {
  const intel = useIntelligence();
  return (
    <IntelContext.Provider value={intel}>
      <StatusBar style="dark" backgroundColor={C.bg} />
      <View style={{ flex: 1, backgroundColor: C.bg }}>
        <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: C.bg }, animation: "slide_from_right" }}>
          <Stack.Screen name="(tabs)" />
          <Stack.Screen name="detail" options={{ presentation: "card", animation: "slide_from_right" }} />
          <Stack.Screen name="report-incident" options={{ presentation: "card", animation: "slide_from_right" }} />
        </Stack>
      </View>
    </IntelContext.Provider>
  );
}
