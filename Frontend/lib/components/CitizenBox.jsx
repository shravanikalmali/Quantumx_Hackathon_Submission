import React from "react";
import { View, Text, StyleSheet } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { C, RADIUS, SPACING } from "../constants";

export default function CitizenBox({ text, style }) {
  if (!text) return null;
  return (
    <View style={[s.box, style]}>
      <Ionicons name="information-circle-outline" size={16} color={C.info} />
      <Text style={s.text}>{text}</Text>
    </View>
  );
}

const s = StyleSheet.create({
  box: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: SPACING.sm,
    backgroundColor: C.infoBg,
    borderLeftWidth: 3,
    borderLeftColor: C.info,
    borderTopRightRadius: RADIUS.md,
    borderBottomRightRadius: RADIUS.md,
    padding: SPACING.md,
    marginBottom: SPACING.md,
  },
  text: { flex: 1, fontSize: 13, color: C.infoText, lineHeight: 19 },
});
