/**
 * Application Constants
 */

// Source-material limits for the composer's file/URL/video/text intake.
// Content flows through several sequential LLM calls (Research -> Strategist
// -> Template -> Proofreader), so its size drives cost across the whole
// pipeline, not just once — kept well past what a 5-10 slide carousel needs.
export const MAX_UPLOAD_FILE_SIZE_BYTES = 10 * 1024 * 1024; // 10MB
export const MAX_SOURCE_CONTENT_CHARS = 20000; // ~7-10 dense pages

export const ALLOWED_DOODLE_TOPICS = [
    "ab_testing_split", "accessibility_focus", "ai_ethics", "analytics_chart", "analytics_dashboard",
    "api_connector", "api_handshake", "autonomous_vehicle", "battery_power", "binary_rain",
    "binary_waterfall", "blockchain_link", "breadcrumb_trail", "bug_report", "calendar_picker",
    "chat_support", "chatbot_dialogue", "chatbot_head", "checkbox_group", "cloud_computing",
    "cloud_sync", "code_brackets", "code_review", "code_snippet", "coffee_fuel",
    "color_palette_swatch", "computer_vision", "construction_crane", "cooling_system", "cpu_chip",
    "cyber_shield", "dark_mode_toggle", "data_mining", "database_cylinder", "dataset_folder",
    "decision_tree", "digital_key", "dna_sequencing", "docker_container", "download_arrow",
    "drone_surveillance", "email_envelope", "encryption_key", "energy_cell", "error_404",
    "error_warning", "ethernet_plug", "facial_recognition", "filter_funnel", "fingerprint_scan",
    "firewall_brick", "folder_tree", "generative_art", "git_branch", "global_network",
    "golden_ratio", "gpu_cluster", "grid_system", "hamburger_menu", "headphones_mic",
    "heatmap_analysis", "hidden_layer", "html_tags", "idea_bulb", "image_placeholder",
    "infinite_loop", "infinite_scroll", "internet_of_things", "kanban_board", "language_translation",
    "launch_rocket", "layer_stack", "legacy_floppy", "linux_penguin", "loading_spinner",
    "machine_learning", "map_location", "maze_solver", "mechanical_keyboard", "media_play",
    "microchip_processor", "mobile_responsive", "modal_overlay", "motherboard_trace", "mouse_cursor",
    "nanobot_swarm", "neural_net", "neural_network", "notification_bell", "open_source",
    "pagination_dots", "predictive_graph", "puzzle_logic", "python_script", "quantum_qubit",
    "radio_selection", "recycle_bin", "responsive_devices", "robot_arm", "robotic_handshake",
    "rubber_duck", "satellite_uplink", "search_algorithm", "search_magnifier", "secure_login",
    "sentiment_analysis", "server_rack", "settings_gear", "share_network", "shopping_cart",
    "slider_control", "smart_assistant", "smart_glasses", "software_bug", "sprint_timer",
    "storage_silo", "success_state", "synthetic_brain", "targeted_ads", "tech_singularity",
    "tech_stack", "terminal_window", "toggle_switch", "tooltip_info", "touch_gesture",
    "typography_specimen", "usb_drive", "user_avatar", "user_persona_card", "user_profile",
    "vector_pen_tool", "virtual_reality", "vr_headset", "web_globe", "wifi_signal",
    "wireframe_layout", "wireless_signal",
    // Nature / weather / science / education / everyday — so EDUCATIONAL, kids,
    // and how-to carousels (illustrationMode LITERAL) can pick a doodle of the
    // ACTUAL subject instead of being forced into a tech/B2B metaphor. These feed
    // buildDoodlePrompt(), which draws the subject literally.
    "rain_cloud", "storm_cloud", "sun_shining", "moon_crescent", "water_drop",
    "water_cycle", "puddle_splash", "river_stream", "ocean_wave", "mountain_peak",
    "tree_oak", "green_leaf", "flower_bloom", "seed_sprout", "snowflake_crystal",
    "wind_gust", "rainbow_arc", "lightning_bolt", "thermometer_temperature",
    "planet_earth", "solar_system", "volcano_erupting", "microscope_lab",
    "test_tube", "atom_model", "dna_helix", "magnet_horseshoe", "telescope_stars",
    "human_body", "beating_heart", "food_apple", "open_book", "pencil_writing",
    "chalkboard", "school_bag", "globe_world", "compass_rose", "cozy_house",
    "butterfly", "songbird", "swimming_fish", "dinosaur", "paw_print"
];

export const SHARED_ICONS = [
    "Lightbulb", "Target", "TrendingUp", "TrendingDown", "Zap", "Award", "CheckCircle",
    "Star", "Rocket", "Brain", "Users", "MessageSquare", "Shield", "Globe", "Compass",
    "Heart", "Clock", "Calendar", "Book", "Briefcase", "DollarSign", "BarChart",
    "Layers", "Package", "Settings", "AlertCircle", "Info", "Sparkles",
    // Nature / weather / science / education / everyday. All are valid Lucide
    // names, resolved dynamically by utils/iconGenerator.ts (unknown names fall
    // back to empty, so these are safe to offer to the model).
    "Cloud", "CloudRain", "CloudSun", "Sun", "Moon", "Droplet", "Droplets",
    "Snowflake", "Wind", "Rainbow", "Thermometer", "Leaf", "TreeDeciduous",
    "Sprout", "Flower", "Mountain", "Waves", "Flame", "Fish", "Bird", "Bug",
    "PawPrint", "FlaskConical", "TestTube", "Microscope", "Atom", "Telescope",
    "Magnet", "Dna", "GraduationCap", "Baby", "Pencil", "Ruler", "Palette",
    "Music", "MapPin", "Home", "Apple", "Bike"
];
