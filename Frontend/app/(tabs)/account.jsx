import React, { useState } from "react";
import {
  View, Text, ScrollView, TouchableOpacity, TextInput,
  StyleSheet, Platform, Alert,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useIntel } from "../_layout";
import { C, SPACING, RADIUS, SHADOW, riskColors } from "../../lib/constants";

const TABS = ["Profile", "Emergency Contacts", "My Reports"];

export default function AccountScreen() {
  const { riskAreas } = useIntel();
  const [activeTab, setActiveTab] = useState("Profile");

  // User data
  const [name, setName] = useState("Shravani K");
  const [phone, setPhone] = useState("6362043695");
  const [email, setEmail] = useState("shravanikalmali@gmail.com");
  const [bloodGroup, setBloodGroup] = useState("O+");
  const [gender, setGender] = useState("Female");
  const [allergies, setAllergies] = useState("Gluten, Lactose");
  const [conditions, setConditions] = useState("None");

  const [contacts, setContacts] = useState([
    { id: "1", name: "Emergency Contact", phone: "8861308954", relation: "Primary" },
  ]);
  const [newContactName, setNewContactName] = useState("");
  const [newContactPhone, setNewContactPhone] = useState("");

  // User's reported incidents (filter from riskAreas or keep separate)
  const myReports = riskAreas.filter(a =>
    a.raw_signals?.some(s => s.source === "user_report")
  );

  const addContact = () => {
    if (!newContactName.trim() || !newContactPhone.trim()) {
      Alert.alert("Required", "Enter both name and phone number.");
      return;
    }
    setContacts(prev => [...prev, {
      id: Date.now().toString(),
      name: newContactName.trim(),
      phone: newContactPhone.trim(),
      relation: "Other",
    }]);
    setNewContactName("");
    setNewContactPhone("");
  };

  const removeContact = (id) => {
    setContacts(prev => prev.filter(c => c.id !== id));
  };

  return (
    <View style={s.root}>
      <View style={s.header}>
        <Ionicons name="person-circle" size={40} color={C.info} />
        <View style={s.headerInfo}>
          <Text style={s.headerName}>{name}</Text>
          <Text style={s.headerPhone}>{phone}</Text>
        </View>
      </View>

      {/* Tab Switcher */}
      <View style={s.tabRow}>
        {TABS.map(tab => (
          <TouchableOpacity
            key={tab}
            style={[s.tab, activeTab === tab && s.tabActive]}
            onPress={() => setActiveTab(tab)}
          >
            <Text style={[s.tabText, activeTab === tab && s.tabTextActive]}>{tab}</Text>
          </TouchableOpacity>
        ))}
      </View>

      <ScrollView style={s.scroll} contentContainerStyle={s.content} showsVerticalScrollIndicator={false}>

        {/* ── Profile Tab ── */}
        {activeTab === "Profile" && (
          <>
            <Text style={s.sectionLabel}>Personal Details</Text>
            <View style={s.fieldCard}>
              <FieldRow label="Full Name" value={name} onChangeText={setName} />
              <FieldRow label="Phone" value={phone} onChangeText={setPhone} keyboardType="phone-pad" />
              <FieldRow label="Email" value={email} onChangeText={setEmail} keyboardType="email-address" />
              <FieldRow label="Gender" value={gender} onChangeText={setGender} />
              <FieldRow label="Blood Group" value={bloodGroup} onChangeText={setBloodGroup} last />
            </View>

            <Text style={s.sectionLabel}>Medical Info</Text>
            <View style={s.fieldCard}>
              <FieldRow label="Allergies" value={allergies} onChangeText={setAllergies} />
              <FieldRow label="Conditions" value={conditions} onChangeText={setConditions} last />
            </View>
          </>
        )}

        {/* ── Emergency Contacts Tab ── */}
        {activeTab === "Emergency Contacts" && (
          <>
            <Text style={s.sectionLabel}>Your Emergency Contacts</Text>
            {contacts.map(c => (
              <View key={c.id} style={s.contactCard}>
                <View style={s.contactInfo}>
                  <Text style={s.contactName}>{c.name}</Text>
                  <Text style={s.contactPhone}>{c.phone}</Text>
                  <Text style={s.contactRelation}>{c.relation}</Text>
                </View>
                <TouchableOpacity onPress={() => removeContact(c.id)} style={s.removeBtn}>
                  <Ionicons name="trash-outline" size={18} color={C.critical} />
                </TouchableOpacity>
              </View>
            ))}

            <Text style={[s.sectionLabel, { marginTop: SPACING.lg }]}>Add New Contact</Text>
            <View style={s.fieldCard}>
              <TextInput
                style={s.input}
                placeholder="Contact name"
                placeholderTextColor={C.textDim}
                value={newContactName}
                onChangeText={setNewContactName}
              />
              <TextInput
                style={s.input}
                placeholder="Phone number"
                placeholderTextColor={C.textDim}
                value={newContactPhone}
                onChangeText={setNewContactPhone}
                keyboardType="phone-pad"
              />
              <TouchableOpacity style={s.addBtn} onPress={addContact}>
                <Ionicons name="add-circle-outline" size={18} color="#fff" />
                <Text style={s.addBtnText}>Add Contact</Text>
              </TouchableOpacity>
            </View>
          </>
        )}

        {/* ── My Reports Tab ── */}
        {activeTab === "My Reports" && (
          <>
            <Text style={s.sectionLabel}>Incidents You Reported</Text>
            {myReports.length === 0 && riskAreas.length === 0 ? (
              <View style={s.emptyBox}>
                <Ionicons name="document-text-outline" size={36} color={C.textDim} />
                <Text style={s.emptyText}>No reports yet. Use the Report button on the home page to submit an incident.</Text>
              </View>
            ) : myReports.length === 0 ? (
              <View style={s.emptyBox}>
                <Ionicons name="document-text-outline" size={36} color={C.textDim} />
                <Text style={s.emptyText}>No incidents reported by you in the current session.</Text>
              </View>
            ) : (
              myReports.map((area, i) => {
                const col = riskColors(area.risk_label);
                return (
                  <View key={i} style={s.reportCard}>
                    <View style={[s.reportStripe, { backgroundColor: col.base }]} />
                    <View style={s.reportBody}>
                      <Text style={s.reportType}>{(area.incident_type || "incident").replace(/_/g, " ")}</Text>
                      <Text style={s.reportArea}>{area.area_name}</Text>
                      <View style={[s.reportBadge, { backgroundColor: col.bg }]}>
                        <Text style={[s.reportBadgeText, { color: col.text }]}>{area.risk_label}</Text>
                      </View>
                    </View>
                  </View>
                );
              })
            )}

            {/* Also show all incidents for demo purposes */}
            {riskAreas.length > 0 && myReports.length === 0 && (
              <>
                <Text style={[s.sectionLabel, { marginTop: SPACING.lg }]}>All Active Incidents</Text>
                {riskAreas.slice(0, 5).map((area, i) => {
                  const col = riskColors(area.risk_label);
                  return (
                    <View key={i} style={s.reportCard}>
                      <View style={[s.reportStripe, { backgroundColor: col.base }]} />
                      <View style={s.reportBody}>
                        <Text style={s.reportType}>{(area.incident_type || "incident").replace(/_/g, " ")}</Text>
                        <Text style={s.reportArea}>{area.area_name}</Text>
                        <View style={[s.reportBadge, { backgroundColor: col.bg }]}>
                          <Text style={[s.reportBadgeText, { color: col.text }]}>{area.risk_label}</Text>
                        </View>
                      </View>
                    </View>
                  );
                })}
              </>
            )}
          </>
        )}

        <View style={{ height: SPACING.xl * 2 }} />
      </ScrollView>
    </View>
  );
}

function FieldRow({ label, value, onChangeText, keyboardType, last }) {
  return (
    <View style={[s.fieldRow, !last && s.fieldRowBorder]}>
      <Text style={s.fieldLabel2}>{label}</Text>
      <TextInput
        style={s.fieldInput}
        value={value}
        onChangeText={onChangeText}
        keyboardType={keyboardType || "default"}
      />
    </View>
  );
}

const s = StyleSheet.create({
  root: { flex: 1, backgroundColor: C.bg },
  header: {
    flexDirection: "row", alignItems: "center", gap: SPACING.md,
    backgroundColor: C.surface, borderBottomWidth: 1, borderBottomColor: C.border,
    paddingHorizontal: SPACING.lg, paddingVertical: SPACING.md,
    paddingTop: Platform.OS === "ios" ? 52 : SPACING.lg,
  },
  headerInfo: { flex: 1 },
  headerName: { fontSize: 18, fontWeight: "700", color: C.text },
  headerPhone: { fontSize: 13, color: C.textMuted, marginTop: 2 },

  // Tabs
  tabRow: {
    flexDirection: "row", backgroundColor: C.surface,
    borderBottomWidth: 1, borderBottomColor: C.border,
  },
  tab: {
    flex: 1, alignItems: "center", paddingVertical: SPACING.md,
    borderBottomWidth: 2, borderBottomColor: "transparent",
  },
  tabActive: { borderBottomColor: C.info },
  tabText: { fontSize: 12, fontWeight: "600", color: C.textMuted },
  tabTextActive: { color: C.info },

  // Content
  scroll: { flex: 1 },
  content: { padding: SPACING.lg },

  sectionLabel: {
    fontSize: 11, fontWeight: "700", color: C.textDim,
    textTransform: "uppercase", letterSpacing: 0.6,
    marginBottom: SPACING.sm, marginTop: SPACING.sm,
  },

  // Field Card
  fieldCard: {
    backgroundColor: C.surface, borderRadius: RADIUS.lg,
    overflow: "hidden", marginBottom: SPACING.md, ...SHADOW.card,
  },
  fieldRow: {
    flexDirection: "row", alignItems: "center", justifyContent: "space-between",
    paddingHorizontal: SPACING.lg, paddingVertical: SPACING.md,
  },
  fieldRowBorder: { borderBottomWidth: 1, borderBottomColor: C.border },
  fieldLabel2: { fontSize: 13, color: C.textMuted, fontWeight: "500" },
  fieldInput: { fontSize: 14, fontWeight: "600", color: C.text, textAlign: "right", flex: 1, marginLeft: SPACING.md },

  infoRow: {
    flexDirection: "row", alignItems: "center", gap: SPACING.sm,
    paddingHorizontal: SPACING.lg, paddingVertical: SPACING.md,
    borderBottomWidth: 1, borderBottomColor: C.border,
  },
  infoText: { fontSize: 13, color: C.textSec },

  // Contact Card
  contactCard: {
    flexDirection: "row", alignItems: "center",
    backgroundColor: C.surface, borderRadius: RADIUS.lg,
    padding: SPACING.md, marginBottom: SPACING.sm, ...SHADOW.card,
  },
  contactInfo: { flex: 1 },
  contactName: { fontSize: 14, fontWeight: "700", color: C.text },
  contactPhone: { fontSize: 13, color: C.textMuted, marginTop: 2 },
  contactRelation: { fontSize: 11, color: C.textDim, marginTop: 2 },
  removeBtn: { padding: SPACING.sm },

  input: {
    borderBottomWidth: 1, borderBottomColor: C.border,
    paddingHorizontal: SPACING.lg, paddingVertical: SPACING.md,
    fontSize: 14, color: C.text,
  },
  addBtn: {
    flexDirection: "row", alignItems: "center", justifyContent: "center",
    gap: SPACING.sm, backgroundColor: C.info, margin: SPACING.md,
    borderRadius: RADIUS.md, paddingVertical: SPACING.md,
  },
  addBtnText: { fontSize: 14, fontWeight: "600", color: "#fff" },

  // Report Card
  reportCard: {
    flexDirection: "row", backgroundColor: C.surface,
    borderRadius: RADIUS.lg, overflow: "hidden",
    marginBottom: SPACING.sm, ...SHADOW.card,
  },
  reportStripe: { width: 4, alignSelf: "stretch" },
  reportBody: { flex: 1, padding: SPACING.md },
  reportType: { fontSize: 13, fontWeight: "700", color: C.text, textTransform: "capitalize" },
  reportArea: { fontSize: 12, color: C.textMuted, marginTop: 2 },
  reportBadge: {
    alignSelf: "flex-start", borderRadius: RADIUS.pill,
    paddingHorizontal: 8, paddingVertical: 2, marginTop: 6,
  },
  reportBadgeText: { fontSize: 10, fontWeight: "700" },

  // Empty
  emptyBox: {
    alignItems: "center", paddingVertical: SPACING.xl * 2, gap: SPACING.sm,
  },
  emptyText: { fontSize: 13, color: C.textMuted, textAlign: "center", lineHeight: 19 },
});
