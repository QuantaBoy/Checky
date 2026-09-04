/**
 * Seed dataset for the demo environment.
 *
 * Everything here is synthetic. No production PII, no real watchlist records and no
 * real departmental credentials (PRD.md §10). Sites and coordinates are real Gujarat
 * locations so that distances, routes and travel times on the map are physically
 * meaningful rather than decorative.
 */

import type {
  Adapter,
  Camera,
  CameraType,
  Department,
  Protocol,
  StorageType,
  User,
  WatchlistEntry,
} from "./types";
import { intBetween, mulberry32, pick } from "./rng";

export const DEPARTMENTS: Department[] = [
  { id: "D01", name: "Home Department (State Police)", shortName: "Home/Police", district: "Gandhinagar", nodalOfficer: "SP (Technical Services)", vmsVendor: "Milestone XProtect", contact: "tech.cell@police.example.gov.in" },
  { id: "D02", name: "Urban Development & Urban Housing", shortName: "Urban Dev", district: "Ahmedabad", nodalOfficer: "Dy. Municipal Commissioner (IT)", vmsVendor: "Hikvision HikCentral", contact: "it.cell@amc.example.gov.in" },
  { id: "D03", name: "Roads & Buildings Department", shortName: "R&B", district: "Gandhinagar", nodalOfficer: "Executive Engineer (Highways)", vmsVendor: "Dahua DSS", contact: "ee.highways@rnb.example.gov.in" },
  { id: "D04", name: "Ports & Transport Department", shortName: "Ports & Transport", district: "Jamnagar", nodalOfficer: "Port Security Officer", vmsVendor: "Genetec Security Center", contact: "security@ports.example.gov.in" },
  { id: "D05", name: "Gujarat State Road Transport Corporation", shortName: "GSRTC", district: "Ahmedabad", nodalOfficer: "Chief Traffic Manager", vmsVendor: "CP Plus Orange", contact: "ctm@gsrtc.example.gov.in" },
  { id: "D06", name: "Health & Family Welfare Department", shortName: "Health", district: "Ahmedabad", nodalOfficer: "Hospital Administrator", vmsVendor: "Honeywell MAXPRO", contact: "admin@health.example.gov.in" },
  { id: "D07", name: "Education Department", shortName: "Education", district: "Vadodara", nodalOfficer: "District Education Officer", vmsVendor: "Uniview EZStation", contact: "deo.vadodara@edu.example.gov.in" },
  { id: "D08", name: "Forest & Environment Department", shortName: "Forest", district: "Junagadh", nodalOfficer: "Deputy Conservator of Forests", vmsVendor: "Axis Camera Station", contact: "dcf.gir@forest.example.gov.in" },
  { id: "D09", name: "Energy & Petrochemicals Department", shortName: "Energy", district: "Bharuch", nodalOfficer: "Plant Security Head", vmsVendor: "Bosch BVMS", contact: "security@energy.example.gov.in" },
  { id: "D10", name: "Narmada, Water Resources & Kalpsar", shortName: "Water Resources", district: "Narmada", nodalOfficer: "Dam Safety Officer", vmsVendor: "Videonetics IVMS", contact: "dso@nwrws.example.gov.in" },
  { id: "D11", name: "Revenue Department", shortName: "Revenue", district: "Gandhinagar", nodalOfficer: "District Collector (IT)", vmsVendor: "Hikvision HikCentral", contact: "collector.it@revenue.example.gov.in" },
  { id: "D12", name: "Industries & Mines Department", shortName: "Industries", district: "Surat", nodalOfficer: "GIDC Estate Manager", vmsVendor: "Dahua DSS", contact: "estate@gidc.example.gov.in" },
  { id: "D13", name: "Tourism Department (TCGL)", shortName: "Tourism", district: "Narmada", nodalOfficer: "Site Security Manager", vmsVendor: "Matrix SATATYA", contact: "security@tourism.example.gov.in" },
  { id: "D14", name: "Agriculture, Farmers Welfare & Co-operation", shortName: "Agriculture", district: "Rajkot", nodalOfficer: "APMC Secretary", vmsVendor: "CP Plus Orange", contact: "secretary@apmc.example.gov.in" },
  { id: "D15", name: "Food, Civil Supplies & Consumer Affairs", shortName: "Food & Civil Supplies", district: "Mehsana", nodalOfficer: "Godown Manager", vmsVendor: "Vivotek VAST", contact: "godown@fcs.example.gov.in" },
  { id: "D16", name: "Panchayat, Rural Housing & Rural Development", shortName: "Panchayat", district: "Patan", nodalOfficer: "Taluka Development Officer", vmsVendor: "Hikvision HikCentral", contact: "tdo@panchayat.example.gov.in" },
  { id: "D17", name: "Sports, Youth & Cultural Activities", shortName: "Sports & Culture", district: "Ahmedabad", nodalOfficer: "Stadium Security Officer", vmsVendor: "Genetec Security Center", contact: "security@sports.example.gov.in" },
  { id: "D18", name: "Labour, Skill Development & Employment", shortName: "Labour", district: "Surat", nodalOfficer: "ITI Principal", vmsVendor: "Uniview EZStation", contact: "principal.iti@labour.example.gov.in" },
  { id: "D19", name: "Science & Technology Department", shortName: "Science & Tech", district: "Gandhinagar", nodalOfficer: "Data Centre Manager", vmsVendor: "Milestone XProtect", contact: "dc.manager@dst.example.gov.in" },
  { id: "D20", name: "Social Justice & Empowerment", shortName: "Social Justice", district: "Bhavnagar", nodalOfficer: "Hostel Warden (Security)", vmsVendor: "CP Plus Orange", contact: "warden@sje.example.gov.in" },
  { id: "D21", name: "Tribal Development Department", shortName: "Tribal Dev", district: "Dahod", nodalOfficer: "Project Administrator", vmsVendor: "Matrix SATATYA", contact: "pa@tribal.example.gov.in" },
  { id: "D22", name: "Finance Department (Commercial Tax / GST)", shortName: "Finance", district: "Ahmedabad", nodalOfficer: "Check-post Officer", vmsVendor: "Dahua DSS", contact: "checkpost@ctd.example.gov.in" },
  { id: "D23", name: "General Administration Department", shortName: "GAD", district: "Gandhinagar", nodalOfficer: "Secretariat Security Officer", vmsVendor: "Bosch BVMS", contact: "security@gad.example.gov.in" },
  { id: "D24", name: "Climate Change Department", shortName: "Climate Change", district: "Kutch", nodalOfficer: "Solar Park Security Lead", vmsVendor: "Axis Camera Station", contact: "security@ccd.example.gov.in" },
  { id: "D25", name: "Legislative & Parliamentary Affairs", shortName: "Legislative", district: "Gandhinagar", nodalOfficer: "Vidhan Sabha Security", contact: "security@vidhansabha.example.gov.in", vmsVendor: "Honeywell MAXPRO" },
  { id: "D26", name: "Water Supply Department (GWSSB)", shortName: "Water Supply", district: "Rajkot", nodalOfficer: "Pumping Station Incharge", vmsVendor: "Vivotek VAST", contact: "incharge@gwssb.example.gov.in" },
];

interface SiteDef {
  name: string;
  site: string;
  district: string;
  lat: number;
  lng: number;
  deptId: string;
  /** Ordered highway corridors this camera sits on. Drives realistic routing. */
  corridor?: string;
  /** Position along the corridor, west/north to east/south. */
  order?: number;
  anpr?: boolean;
  type?: CameraType;
}

/**
 * ~55 sites across Gujarat. Corridor-tagged cameras form physically coherent
 * chains, so a traced vehicle's route follows a road that exists.
 */
const SITES: SiteDef[] = [
  // ── NH-48 corridor: Ahmedabad → Vadodara → Bharuch → Surat → Vapi ──
  { name: "CAM-NH48-01 Narol Circle", site: "Narol Circle, NH-48", district: "Ahmedabad", lat: 22.9803, lng: 72.5904, deptId: "D03", corridor: "NH48", order: 1, anpr: true, type: "anpr" },
  { name: "CAM-NH48-02 Kheda Toll Plaza", site: "Kheda Toll Plaza", district: "Kheda", lat: 22.7500, lng: 72.6836, deptId: "D03", corridor: "NH48", order: 2, anpr: true, type: "anpr" },
  { name: "CAM-NH48-03 Nadiad Bypass", site: "Nadiad Bypass Junction", district: "Kheda", lat: 22.6939, lng: 72.8616, deptId: "D03", corridor: "NH48", order: 3, anpr: true, type: "anpr" },
  { name: "CAM-NH48-04 Anand Vallabh Vidyanagar", site: "Anand Highway Entry", district: "Anand", lat: 22.5645, lng: 72.9289, deptId: "D22", corridor: "NH48", order: 4, anpr: true, type: "anpr" },
  { name: "CAM-NH48-05 Vadodara Ajwa Cross", site: "Ajwa Road Crossing", district: "Vadodara", lat: 22.3072, lng: 73.1812, deptId: "D02", corridor: "NH48", order: 5, anpr: true, type: "anpr" },
  { name: "CAM-NH48-06 Bharuch Golden Bridge", site: "Golden Bridge, Narmada", district: "Bharuch", lat: 21.7051, lng: 72.9959, deptId: "D03", corridor: "NH48", order: 6, anpr: true, type: "anpr" },
  { name: "CAM-NH48-07 Ankleshwar GIDC Gate", site: "Ankleshwar GIDC Main Gate", district: "Bharuch", lat: 21.6279, lng: 73.0143, deptId: "D12", corridor: "NH48", order: 7, anpr: true, type: "anpr" },
  { name: "CAM-NH48-08 Kim Char Rasta", site: "Kim Char Rasta", district: "Surat", lat: 21.3500, lng: 72.9600, deptId: "D03", corridor: "NH48", order: 8, anpr: true, type: "anpr" },
  { name: "CAM-NH48-09 Surat Sachin Junction", site: "Sachin GIDC Junction", district: "Surat", lat: 21.0800, lng: 72.8800, deptId: "D12", corridor: "NH48", order: 9, anpr: true, type: "anpr" },
  { name: "CAM-NH48-10 Navsari Toll", site: "Navsari Toll Plaza", district: "Navsari", lat: 20.9467, lng: 72.9520, deptId: "D03", corridor: "NH48", order: 10, anpr: true, type: "anpr" },
  { name: "CAM-NH48-11 Valsad Check Post", site: "Valsad Check Post", district: "Valsad", lat: 20.5992, lng: 72.9342, deptId: "D22", corridor: "NH48", order: 11, anpr: true, type: "anpr" },
  { name: "CAM-NH48-12 Vapi Border Post", site: "Vapi Inter-State Border Post", district: "Valsad", lat: 20.3893, lng: 72.9106, deptId: "D22", corridor: "NH48", order: 12, anpr: true, type: "anpr" },

  // ── Ahmedabad city ring ──
  { name: "CAM-AMD-01 SG Highway Thaltej", site: "Thaltej Cross Roads, SG Highway", district: "Ahmedabad", lat: 23.0500, lng: 72.5100, deptId: "D02", corridor: "AMD-RING", order: 1, anpr: true, type: "anpr" },
  { name: "CAM-AMD-02 Iskcon Circle", site: "Iskcon Circle", district: "Ahmedabad", lat: 23.0290, lng: 72.5070, deptId: "D02", corridor: "AMD-RING", order: 2, anpr: true, type: "anpr" },
  { name: "CAM-AMD-03 Vastrapur Lake", site: "Vastrapur Lake Garden", district: "Ahmedabad", lat: 23.0380, lng: 72.5290, deptId: "D02", corridor: "AMD-RING", order: 3, type: "ptz" },
  { name: "CAM-AMD-04 Ashram Road", site: "Ashram Road Riverfront", district: "Ahmedabad", lat: 23.0330, lng: 72.5710, deptId: "D02", corridor: "AMD-RING", order: 4, anpr: true, type: "anpr" },
  { name: "CAM-AMD-05 Lal Darwaja BRTS", site: "Lal Darwaja BRTS Terminal", district: "Ahmedabad", lat: 23.0250, lng: 72.5810, deptId: "D05", corridor: "AMD-RING", order: 5, type: "dome" },
  { name: "CAM-AMD-06 Kalupur Station Gate", site: "Kalupur Railway Station Approach", district: "Ahmedabad", lat: 23.0270, lng: 72.6010, deptId: "D05", corridor: "AMD-RING", order: 6, anpr: true, type: "anpr" },
  { name: "CAM-AMD-07 Naroda GIDC", site: "Naroda Industrial Estate", district: "Ahmedabad", lat: 23.0700, lng: 72.6600, deptId: "D12", corridor: "AMD-RING", order: 7, anpr: true, type: "bullet" },
  { name: "CAM-AMD-08 Civil Hospital Gate", site: "Civil Hospital Asarwa Gate 2", district: "Ahmedabad", lat: 23.0530, lng: 72.6060, deptId: "D06", type: "dome" },
  { name: "CAM-AMD-09 Motera Stadium", site: "Narendra Modi Stadium Gate 4", district: "Ahmedabad", lat: 23.0920, lng: 72.5970, deptId: "D17", anpr: true, type: "ptz" },
  { name: "CAM-AMD-10 Geeta Mandir Bus Port", site: "Geeta Mandir Central Bus Port", district: "Ahmedabad", lat: 23.0130, lng: 72.5890, deptId: "D05", type: "dome" },

  // ── Gandhinagar capital complex ──
  { name: "CAM-GNR-01 Sector 10 Secretariat", site: "Sachivalaya Gate 1, Sector 10", district: "Gandhinagar", lat: 23.2260, lng: 72.6490, deptId: "D23", corridor: "GNR", order: 1, anpr: true, type: "anpr" },
  { name: "CAM-GNR-02 Vidhan Sabha", site: "Vidhan Sabha Complex", district: "Gandhinagar", lat: 23.2300, lng: 72.6470, deptId: "D25", corridor: "GNR", order: 2, type: "ptz" },
  { name: "CAM-GNR-03 GIFT City Gate", site: "GIFT City Main Approach", district: "Gandhinagar", lat: 23.1600, lng: 72.6840, deptId: "D19", corridor: "GNR", order: 3, anpr: true, type: "anpr" },
  { name: "CAM-GNR-04 State Data Centre", site: "Gujarat State Data Centre", district: "Gandhinagar", lat: 23.2156, lng: 72.6369, deptId: "D19", type: "fixed" },
  { name: "CAM-GNR-05 Adalaj Toll", site: "Adalaj Toll Plaza, SH-71", district: "Gandhinagar", lat: 23.1650, lng: 72.5800, deptId: "D03", corridor: "GNR", order: 4, anpr: true, type: "anpr" },
  { name: "CAM-GNR-06 Police HQ", site: "State Police HQ, Sector 18", district: "Gandhinagar", lat: 23.2050, lng: 72.6280, deptId: "D01", type: "dome" },

  // ── Saurashtra corridor: Rajkot → Jamnagar → Dwarka ──
  { name: "CAM-SAU-01 Rajkot Kalawad Road", site: "Kalawad Road Junction", district: "Rajkot", lat: 22.2900, lng: 70.7700, deptId: "D02", corridor: "SAU", order: 1, anpr: true, type: "anpr" },
  { name: "CAM-SAU-02 Rajkot APMC Yard", site: "Rajkot APMC Market Yard", district: "Rajkot", lat: 22.3039, lng: 70.8022, deptId: "D14", corridor: "SAU", order: 2, anpr: true, type: "bullet" },
  { name: "CAM-SAU-03 Morbi Bridge Approach", site: "Machchhu Bridge Approach", district: "Morbi", lat: 22.8173, lng: 70.8370, deptId: "D03", type: "fixed" },
  { name: "CAM-SAU-04 Jamnagar Bypass", site: "Jamnagar Bypass Circle", district: "Jamnagar", lat: 22.4707, lng: 70.0577, deptId: "D03", corridor: "SAU", order: 3, anpr: true, type: "anpr" },
  { name: "CAM-SAU-05 Bedi Port Gate", site: "Bedi Port Entry Gate", district: "Jamnagar", lat: 22.5000, lng: 70.0300, deptId: "D04", corridor: "SAU", order: 4, anpr: true, type: "anpr" },
  { name: "CAM-SAU-06 Dwarka Temple Approach", site: "Dwarkadhish Temple Approach", district: "Devbhumi Dwarka", lat: 22.2394, lng: 68.9678, deptId: "D13", corridor: "SAU", order: 5, type: "ptz" },
  { name: "CAM-SAU-07 Porbandar Jetty", site: "Porbandar Fishing Jetty", district: "Porbandar", lat: 21.6417, lng: 69.6293, deptId: "D04", anpr: true, type: "bullet" },
  { name: "CAM-SAU-08 Somnath Temple Gate", site: "Somnath Temple Gate 3", district: "Gir Somnath", lat: 20.8880, lng: 70.4012, deptId: "D13", type: "ptz" },
  { name: "CAM-SAU-09 Junagadh Bus Stand", site: "Junagadh ST Bus Stand", district: "Junagadh", lat: 21.5222, lng: 70.4579, deptId: "D05", type: "dome" },
  { name: "CAM-SAU-10 Gir Sasan Check Post", site: "Sasan Gir Forest Check Post", district: "Gir Somnath", lat: 21.1244, lng: 70.8000, deptId: "D08", anpr: true, type: "thermal" },
  { name: "CAM-SAU-11 Bhavnagar Port Road", site: "Bhavnagar Port Approach Road", district: "Bhavnagar", lat: 21.7645, lng: 72.1519, deptId: "D04", anpr: true, type: "anpr" },
  { name: "CAM-SAU-12 Alang Ship Yard Gate", site: "Alang Ship Breaking Yard Gate", district: "Bhavnagar", lat: 21.4000, lng: 72.1900, deptId: "D12", anpr: true, type: "bullet" },
  { name: "CAM-SAU-13 Surendranagar Highway", site: "Surendranagar SH-17 Junction", district: "Surendranagar", lat: 22.7196, lng: 71.6369, deptId: "D03", anpr: true, type: "anpr" },
  { name: "CAM-SAU-14 Bhavnagar Hostel", site: "Govt. Hostel Campus, Bhavnagar", district: "Bhavnagar", lat: 21.7700, lng: 72.1400, deptId: "D20", type: "dome" },

  // ── North Gujarat ──
  { name: "CAM-NGJ-01 Mehsana Godown", site: "FCI Godown, Mehsana", district: "Mehsana", lat: 23.5880, lng: 72.3693, deptId: "D15", type: "fixed" },
  { name: "CAM-NGJ-02 Patan Taluka Office", site: "Taluka Panchayat, Patan", district: "Patan", lat: 23.8493, lng: 72.1266, deptId: "D16", type: "dome" },
  { name: "CAM-NGJ-03 Palanpur Border Check", site: "Palanpur Inter-State Check Post", district: "Banaskantha", lat: 24.1747, lng: 72.4381, deptId: "D22", anpr: true, type: "anpr" },
  { name: "CAM-NGJ-04 Ambaji Temple Road", site: "Ambaji Temple Approach", district: "Banaskantha", lat: 24.3300, lng: 72.8500, deptId: "D13", type: "ptz" },
  { name: "CAM-NGJ-05 Godhra Junction", site: "Godhra Railway Junction Road", district: "Panchmahal", lat: 22.7788, lng: 73.6143, deptId: "D05", anpr: true, type: "anpr" },
  { name: "CAM-NGJ-06 Dahod Tribal Project", site: "Tribal Project Office, Dahod", district: "Dahod", lat: 22.8350, lng: 74.2500, deptId: "D21", type: "dome" },

  // ── South / Central assets ──
  { name: "CAM-SGJ-01 Statue of Unity Gate", site: "Statue of Unity Visitor Gate", district: "Narmada", lat: 21.8380, lng: 73.7191, deptId: "D13", anpr: true, type: "ptz" },
  { name: "CAM-SGJ-02 Sardar Sarovar Dam", site: "Sardar Sarovar Dam Crest", district: "Narmada", lat: 21.8300, lng: 73.7470, deptId: "D10", type: "thermal" },
  { name: "CAM-SGJ-03 Dahej Port Gate", site: "Dahej Port Container Gate", district: "Bharuch", lat: 21.7000, lng: 72.5300, deptId: "D04", anpr: true, type: "anpr" },
  { name: "CAM-SGJ-04 Hazira Terminal", site: "Hazira Industrial Terminal", district: "Surat", lat: 21.1000, lng: 72.6500, deptId: "D09", anpr: true, type: "bullet" },
  { name: "CAM-SGJ-05 Surat Diamond Bourse", site: "Surat Diamond Bourse Approach", district: "Surat", lat: 21.1400, lng: 72.7700, deptId: "D12", anpr: true, type: "anpr" },
  { name: "CAM-SGJ-06 Surat ITI Campus", site: "Government ITI, Surat", district: "Surat", lat: 21.1702, lng: 72.8311, deptId: "D18", type: "dome" },
  { name: "CAM-SGJ-07 Vadodara School Zone", site: "Govt. Secondary School, Vadodara", district: "Vadodara", lat: 22.3200, lng: 73.1600, deptId: "D07", type: "dome" },
  { name: "CAM-SGJ-08 Vadodara Collectorate", site: "District Collectorate, Vadodara", district: "Vadodara", lat: 22.3000, lng: 73.2000, deptId: "D11", type: "fixed" },

  // ── Kutch ──
  { name: "CAM-KTC-01 Bhuj Airport Road", site: "Bhuj Airport Approach Road", district: "Kutch", lat: 23.2420, lng: 69.6669, deptId: "D03", anpr: true, type: "anpr" },
  { name: "CAM-KTC-02 Kandla Port Gate", site: "Deendayal (Kandla) Port Gate 2", district: "Kutch", lat: 23.0330, lng: 70.2170, deptId: "D04", anpr: true, type: "anpr" },
  { name: "CAM-KTC-03 Khavda Solar Park", site: "Khavda Renewable Energy Park", district: "Kutch", lat: 23.8500, lng: 69.7300, deptId: "D24", type: "thermal" },
  { name: "CAM-KTC-04 Rann Utsav Gate", site: "Rann Utsav Tent City Gate", district: "Kutch", lat: 23.9400, lng: 69.6900, deptId: "D13", type: "ptz" },
  { name: "CAM-WS-01 Rajkot Pumping Station", site: "GWSSB Pumping Station, Rajkot", district: "Rajkot", lat: 22.2700, lng: 70.7900, deptId: "D26", type: "fixed" },
];

const VENDORS: Record<string, { models: string[]; protocol: Protocol }> = {
  "Hikvision HikCentral": { models: ["DS-2CD2T87G2", "iDS-2CD7A46G0", "DS-TCG227"], protocol: "onvif" },
  "Dahua DSS": { models: ["IPC-HFW5442E", "ITC431-RW1F", "SD6AL245"], protocol: "onvif" },
  "Milestone XProtect": { models: ["XPCO-Bridge", "M-Series Node"], protocol: "sdk" },
  "Genetec Security Center": { models: ["GSC-Stream", "AutoVu SharpZ3"], protocol: "sdk" },
  "CP Plus Orange": { models: ["CP-UNC-TA41L3C", "CP-GPC-T24L3"], protocol: "rtsp" },
  "Bosch BVMS": { models: ["DINION IP 7100i", "FLEXIDOME IP 5000i"], protocol: "onvif" },
  "Honeywell MAXPRO": { models: ["HC35W45R3", "HBW4PER1"], protocol: "onvif" },
  "Uniview EZStation": { models: ["IPC2324LBR3", "IPC6415SR-X5"], protocol: "rtsp" },
  "Axis Camera Station": { models: ["AXIS P1447-LE", "AXIS Q1798-LE"], protocol: "onvif" },
  "Matrix SATATYA": { models: ["CIBR30FL36CWP", "PZCR20ML33CWP"], protocol: "rtsp" },
  "Vivotek VAST": { models: ["IB9389-EHT", "FD9391-EHTV"], protocol: "onvif" },
  "Videonetics IVMS": { models: ["VN-ANPR-Edge", "VN-Bullet-4K"], protocol: "sdk" },
};

const STORAGE: StorageType[] = ["local_nvr", "cloud", "hybrid", "dvr"];

/** Raw vendor payload samples — the "before" side of protocol normalization. */
const RAW_SAMPLES: Record<string, string> = {
  onvif: `<tt:Event><wsnt:NotificationMessage>
  <tt:Topic>tns1:VideoSource/MotionAlarm</tt:Topic>
  <tt:Message UtcTime="2026-09-03T09:14:22Z">
    <tt:Source><tt:SimpleItem Name="VideoSourceToken" Value="vs_01"/></tt:Source>
    <tt:Data><tt:SimpleItem Name="State" Value="true"/></tt:Data>
  </tt:Message></wsnt:NotificationMessage></tt:Event>`,
  rtsp: `RTSP/1.0 200 OK
Session: 4A5B6C7D;timeout=60
RTP-Info: url=trackID=1;seq=17245;rtptime=884213
x-Device-Status: signal=OK;fps=25;bitrate=4096k`,
  sdk: `{"eventType":"AnalyticsEvent","deviceGuid":"{9F2A-...}",
 "utcTicks":638912345678901234,"payload":{"plateText":"GJ01AB1234",
 "plateConfidence":0.94,"laneId":3,"direction":"INBOUND"}}`,
  hls: `#EXTM3U
#EXT-X-VERSION:4
#EXT-X-TARGETDURATION:6
#EXT-X-MEDIA-SEQUENCE:1187
#EXTINF:6.0,
segment_1187.ts`,
};

export function buildCameras(): Camera[] {
  const rnd = mulberry32(20260907);
  const now = Date.now();
  return SITES.map((s, i) => {
    const dept = DEPARTMENTS.find((d) => d.id === s.deptId)!;
    const v = VENDORS[dept.vmsVendor];
    const analog = rnd() < 0.18;
    // A realistic estate is not 100% healthy — degraded/offline units are what the
    // gap-analysis report exists to surface.
    const roll = rnd();
    const status = roll < 0.82 ? "online" : roll < 0.9 ? "degraded" : roll < 0.96 ? "offline" : "unreachable";
    const id = `CAM-${String(i + 1).padStart(3, "0")}`;
    const installedYearsAgo = intBetween(rnd, 1, 9);
    return {
      id,
      name: s.name,
      deptId: s.deptId,
      lat: s.lat,
      lng: s.lng,
      district: s.district,
      site: s.site,
      type: s.type ?? pick(rnd, ["fixed", "dome", "bullet", "ptz"] as CameraType[]),
      vendor: dept.vmsVendor,
      model: pick(rnd, v.models),
      analog,
      protocol: analog ? "rtsp" : v.protocol,
      endpoint:
        v.protocol === "sdk"
          ? `sdk://${dept.shortName.toLowerCase().replace(/[^a-z]/g, "")}.vms.gujarat.gov.in/device/${id}`
          : `rtsp://10.${20 + Number(s.deptId.slice(1))}.${intBetween(rnd, 1, 250)}.${intBetween(rnd, 2, 250)}:554/stream1`,
      storageType: pick(rnd, STORAGE),
      retentionDays: pick(rnd, [7, 7, 10, 15, 30, 30, 45, 90]),
      status: status as Camera["status"],
      bearing: intBetween(rnd, 0, 359),
      fovDeg: pick(rnd, [60, 75, 90, 110]),
      installedAt: new Date(now - installedYearsAgo * 365 * 864e5).toISOString(),
      onboardedAt: new Date(now - intBetween(rnd, 1, 40) * 864e5).toISOString(),
      lastHeartbeat: status === "offline" || status === "unreachable" ? new Date(now - intBetween(rnd, 3, 200) * 36e5).toISOString() : new Date(now - intBetween(rnd, 1, 90) * 1000).toISOString(),
      anprEnabled: s.anpr ?? false,
      notes: installedYearsAgo >= 8 ? "Approaching end-of-life; vendor firmware support ended." : undefined,
    } satisfies Camera;
  });
}

/** Corridor → camera ids in travel order. Used by the simulator to route vehicles. */
export function buildCorridors(cameras: Camera[]): Record<string, string[]> {
  const out: Record<string, { id: string; order: number }[]> = {};
  SITES.forEach((s, i) => {
    if (!s.corridor) return;
    (out[s.corridor] ??= []).push({ id: cameras[i].id, order: s.order ?? i });
  });
  return Object.fromEntries(
    Object.entries(out).map(([k, v]) => [k, v.sort((a, b) => a.order - b.order).map((x) => x.id)]),
  );
}

export function buildAdapters(cameras: Camera[]): Adapter[] {
  const rnd = mulberry32(776644);
  const now = Date.now();
  const byDeptVendor = new Map<string, Camera[]>();
  for (const c of cameras) {
    const key = `${c.deptId}|${c.vendor}|${c.protocol}`;
    if (!byDeptVendor.has(key)) byDeptVendor.set(key, []);
    byDeptVendor.get(key)!.push(c);
  }
  let n = 0;
  return [...byDeptVendor.entries()].map(([key, cams]) => {
    n += 1;
    const [deptId, vendor, protocol] = key.split("|");
    const dept = DEPARTMENTS.find((d) => d.id === deptId)!;
    const anyUp = cams.some((c) => c.status === "online");
    const allDown = cams.every((c) => c.status === "offline" || c.status === "unreachable");
    const kind: Adapter["kind"] =
      protocol === "sdk" ? "vendor-sdk" : protocol === "hls" ? "hls-passthrough" : "rtsp-onvif";
    return {
      id: `ADP-${String(n).padStart(3, "0")}`,
      name: `${dept.shortName} · ${vendor}`,
      kind,
      deptId,
      vendor,
      cameraIds: cams.map((c) => c.id),
      credentialsRef: `vault://gujarat/sentinel/${deptId.toLowerCase()}/${vendor.split(" ")[0].toLowerCase()}#v${intBetween(rnd, 1, 4)}`,
      health: allDown ? "down" : anyUp ? "healthy" : "degraded",
      lastHeartbeat: new Date(now - intBetween(rnd, 1, 120) * 1000).toISOString(),
      latencyMs: intBetween(rnd, 18, 420),
      eventsPublished: intBetween(rnd, 400, 90000),
      rawSample: RAW_SAMPLES[protocol] ?? RAW_SAMPLES.rtsp,
      version: `1.${intBetween(rnd, 0, 9)}.${intBetween(rnd, 0, 9)}`,
    } satisfies Adapter;
  });
}

export const USERS: User[] = [
  { id: "U1", username: "operator", password: "sentinel", name: "PSI R. K. Chaudhary", role: "operator", deptId: null, designation: "Control Room Operator, State Command Centre" },
  { id: "U2", username: "investigator", password: "sentinel", name: "PI M. J. Solanki", role: "investigator", deptId: null, designation: "Investigating Officer, Crime Branch" },
  { id: "U3", username: "watchlist", password: "sentinel", name: "Smt. A. B. Desai", role: "watchlist_admin", deptId: null, designation: "State Crime Records Bureau" },
  { id: "U4", username: "deptadmin", password: "sentinel", name: "Shri H. P. Patel", role: "dept_admin", deptId: "D02", designation: "Nodal IT Officer, Urban Development" },
  { id: "U5", username: "deptadmin2", password: "sentinel", name: "Shri N. D. Vaghela", role: "dept_admin", deptId: "D03", designation: "Nodal IT Officer, Roads & Buildings" },
  { id: "U6", username: "admin", password: "sentinel", name: "Shri V. S. Raval", role: "platform_admin", deptId: null, designation: "Platform Administrator, Sentinel IVMAP" },
];

export const WATCHLIST: WatchlistEntry[] = [
  { id: "WL-001", kind: "vehicle", category: "stolen_vehicle", value: "GJ01AB1234", description: "White Maruti Swift — reported stolen from Navrangpura", severity: "critical", source: "eGujCop (synthetic)", caseRef: "FIR/2026/AMD/0417", addedBy: "SCRB", addedAt: new Date(Date.now() - 9 * 864e5).toISOString(), active: true },
  { id: "WL-002", kind: "vehicle", category: "stolen_vehicle", value: "GJ05CD5678", description: "Silver Hyundai Creta — stolen, Surat city", severity: "critical", source: "eGujCop (synthetic)", caseRef: "FIR/2026/SRT/1180", addedBy: "SCRB", addedAt: new Date(Date.now() - 21 * 864e5).toISOString(), active: true },
  { id: "WL-003", kind: "vehicle", category: "blacklisted_vehicle", value: "GJ18EF9012", description: "Tata truck — blacklisted, repeated check-post evasion", severity: "high", source: "Commercial Tax (synthetic)", caseRef: "CTD/BL/2026/77", addedBy: "Check-post Officer", addedAt: new Date(Date.now() - 44 * 864e5).toISOString(), active: true },
  { id: "WL-004", kind: "vehicle", category: "suspect_vehicle", value: "GJ06GH3456", description: "Black Mahindra Scorpio — suspect vehicle, robbery investigation", severity: "high", source: "Crime Branch (synthetic)", caseRef: "CR/2026/VAD/0092", addedBy: "PI Solanki", addedAt: new Date(Date.now() - 4 * 864e5).toISOString(), active: true },
  { id: "WL-005", kind: "vehicle", category: "stolen_vehicle", value: "GJ03IJ7890", description: "Red Honda Activa — stolen two-wheeler", severity: "medium", source: "eGujCop (synthetic)", caseRef: "FIR/2026/RJT/0345", addedBy: "SCRB", addedAt: new Date(Date.now() - 15 * 864e5).toISOString(), active: true },
  { id: "WL-006", kind: "vehicle", category: "blacklisted_vehicle", value: "GJ27KL2468", description: "Tanker — expired hazardous-goods permit", severity: "medium", source: "VAHAN (synthetic)", caseRef: "RTO/GJ27/2026/551", addedBy: "Transport", addedAt: new Date(Date.now() - 30 * 864e5).toISOString(), active: true },
  { id: "WL-007", kind: "vehicle", category: "suspect_vehicle", value: "MH12XY4321", description: "Out-of-state sedan flagged at inter-state border", severity: "low", source: "Border Check Post (synthetic)", caseRef: "BCP/2026/PLN/019", addedBy: "Check-post Officer", addedAt: new Date(Date.now() - 6 * 864e5).toISOString(), active: true },
  { id: "WL-008", kind: "person", category: "wanted_person", value: "Suspect A (synthetic)", description: "Wanted — absconding accused, dacoity case. Synthetic record for demo.", severity: "critical", source: "CCTNS (synthetic)", caseRef: "CR/2025/AMD/8891", addedBy: "SCRB", addedAt: new Date(Date.now() - 60 * 864e5).toISOString(), active: true, embedding: [0.14, -0.32, 0.88, 0.05, -0.61] },
  { id: "WL-009", kind: "person", category: "missing_person", value: "Missing Minor B (synthetic)", description: "Missing minor, last seen Kalupur area. Synthetic record for demo.", severity: "high", source: "eGujCop (synthetic)", caseRef: "MP/2026/AMD/0231", addedBy: "SCRB", addedAt: new Date(Date.now() - 3 * 864e5).toISOString(), active: true, embedding: [-0.22, 0.47, 0.10, -0.77, 0.31] },
  { id: "WL-010", kind: "vehicle", category: "stolen_vehicle", value: "GJ21MN1357", description: "Bolero pickup — stolen from Mehsana godown yard", severity: "high", source: "eGujCop (synthetic)", caseRef: "FIR/2026/MSA/0602", addedBy: "SCRB", addedAt: new Date(Date.now() - 11 * 864e5).toISOString(), active: false },
];

/** Plate pool for background (non-watchlisted) traffic. */
export const BACKGROUND_PLATES: string[] = (() => {
  const rnd = mulberry32(4242);
  const rto = ["GJ01", "GJ02", "GJ03", "GJ05", "GJ06", "GJ10", "GJ12", "GJ15", "GJ16", "GJ18", "GJ21", "GJ27", "GJ38", "MH04", "RJ14", "DL8C"];
  const letters = "ABCDEFGHJKLMNPQRSTUVWXYZ";
  const out: string[] = [];
  for (let i = 0; i < 240; i += 1) {
    const s = `${pick(rnd, rto)}${pick(rnd, letters.split(""))}${pick(rnd, letters.split(""))}${String(intBetween(rnd, 1000, 9999))}`;
    out.push(s);
  }
  return [...new Set(out)];
})();

/** All 33 districts of Gujarat, with their headquarters, for coverage gap analysis. */
export const GUJARAT_DISTRICTS: { name: string; lat: number; lng: number }[] = [
  { name: "Ahmedabad", lat: 23.0225, lng: 72.5714 },
  { name: "Amreli", lat: 21.6032, lng: 71.2221 },
  { name: "Anand", lat: 22.5645, lng: 72.9289 },
  { name: "Aravalli", lat: 23.4000, lng: 73.0300 },
  { name: "Banaskantha", lat: 24.1747, lng: 72.4381 },
  { name: "Bharuch", lat: 21.7051, lng: 72.9959 },
  { name: "Bhavnagar", lat: 21.7645, lng: 72.1519 },
  { name: "Botad", lat: 22.1704, lng: 71.6685 },
  { name: "Chhota Udaipur", lat: 22.3050, lng: 74.0150 },
  { name: "Dahod", lat: 22.8350, lng: 74.2500 },
  { name: "Dang", lat: 20.7500, lng: 73.6900 },
  { name: "Devbhumi Dwarka", lat: 22.2394, lng: 68.9678 },
  { name: "Gandhinagar", lat: 23.2156, lng: 72.6369 },
  { name: "Gir Somnath", lat: 20.9077, lng: 70.3670 },
  { name: "Jamnagar", lat: 22.4707, lng: 70.0577 },
  { name: "Junagadh", lat: 21.5222, lng: 70.4579 },
  { name: "Kheda", lat: 22.7500, lng: 72.6836 },
  { name: "Kutch", lat: 23.2420, lng: 69.6669 },
  { name: "Mahisagar", lat: 23.0800, lng: 73.6000 },
  { name: "Mehsana", lat: 23.5880, lng: 72.3693 },
  { name: "Morbi", lat: 22.8173, lng: 70.8370 },
  { name: "Narmada", lat: 21.8700, lng: 73.5000 },
  { name: "Navsari", lat: 20.9467, lng: 72.9520 },
  { name: "Panchmahal", lat: 22.7788, lng: 73.6143 },
  { name: "Patan", lat: 23.8493, lng: 72.1266 },
  { name: "Porbandar", lat: 21.6417, lng: 69.6293 },
  { name: "Rajkot", lat: 22.3039, lng: 70.8022 },
  { name: "Sabarkantha", lat: 23.6000, lng: 72.9800 },
  { name: "Surat", lat: 21.1702, lng: 72.8311 },
  { name: "Surendranagar", lat: 22.7196, lng: 71.6369 },
  { name: "Tapi", lat: 21.1200, lng: 73.4000 },
  { name: "Vadodara", lat: 22.3072, lng: 73.1812 },
  { name: "Valsad", lat: 20.5992, lng: 72.9342 },
];

export const VEHICLE_TYPES = ["Hatchback", "Sedan", "SUV", "Two-wheeler", "LCV", "Truck", "Bus", "Tanker", "Auto-rickshaw"];
export const VEHICLE_COLORS = ["White", "Silver", "Black", "Grey", "Red", "Blue", "Brown", "Yellow"];
export const OBJECT_CLASSES = ["person", "car", "motorcycle", "truck", "bus", "bicycle", "unattended_bag"];
