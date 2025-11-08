# Ansybl Android Example

An Android demonstration application for the Ansybl decentralized social syndication protocol. This app showcases the key features of Ansybl with an interactive walkthrough guide.

## Features

### Core Functionality
- **📱 Feed Display**: View Ansybl posts with rich content, author info, and timestamps
- **✍️ Post Creation**: Create new posts with titles and content
- **🔐 Cryptographic Signing**: Ed25519 signature support for content authenticity
- **👍 Social Interactions**: Like, share, and comment on posts
- **🏷️ Tags & Discovery**: Tag-based content categorization
- **📸 Media Support**: Handle images, videos, and audio attachments

### Interactive Walkthrough
This app includes a comprehensive 21-step guided tour that educates users about:
- Ansybl feed structure
- Post creation and management
- Cryptographic signatures
- Social interaction features
- API endpoints
- Protocol bridges (RSS 2.0, JSON Feed, ActivityPub)
- Content validation
- Media handling
- And much more!

The walkthrough automatically prompts first-time users and can be restarted anytime via the purple info button.

## Architecture

### Technology Stack
- **Language**: Kotlin
- **Min SDK**: 24 (Android 7.0)
- **Target SDK**: 34 (Android 14)
- **UI Framework**: Material Design Components
- **Architecture**: MVVM-ready structure
- **Dependencies**:
  - AndroidX Core, AppCompat, Material Components
  - RecyclerView for efficient list display
  - Gson for JSON serialization
  - OkHttp for networking
  - SharedPreferences for user settings

### Project Structure
```
android-example/
├── app/
│   ├── src/main/
│   │   ├── java/com/ansybl/example/
│   │   │   ├── MainActivity.kt           # Main activity with UI logic
│   │   │   ├── WalkthroughManager.kt     # 21-step guided tour
│   │   │   ├── AnsyblPost.kt             # Data model for posts
│   │   │   └── PostAdapter.kt            # RecyclerView adapter
│   │   ├── res/
│   │   │   ├── layout/
│   │   │   │   ├── activity_main.xml     # Main layout with RecyclerView
│   │   │   │   ├── item_post.xml         # Post card layout
│   │   │   │   └── dialog_create_post.xml # Post creation dialog
│   │   │   ├── menu/
│   │   │   │   └── main_menu.xml         # App menu items
│   │   │   └── values/
│   │   │       ├── strings.xml           # String resources
│   │   │       ├── colors.xml            # Color definitions
│   │   │       └── themes.xml            # Material theme
│   │   └── AndroidManifest.xml
│   ├── build.gradle                      # App-level Gradle config
│   └── proguard-rules.pro
├── build.gradle                          # Project-level Gradle config
├── settings.gradle
└── README.md
```

## Building the App

### Prerequisites
- Android Studio Hedgehog (2023.1.1) or later
- JDK 17 or later
- Android SDK 34
- Gradle 8.2 (automatically downloaded via wrapper)

### Build Steps

1. **Clone the repository**
   ```bash
   git clone https://github.com/pnixon/deshittify.git
   cd deshittify/android-example
   ```

2. **Open in Android Studio**
   - Open Android Studio
   - Select "Open an Existing Project"
   - Navigate to the `android-example` directory
   - Wait for Gradle sync to complete

3. **Build the project**
   ```bash
   ./gradlew build
   ```

4. **Run on device/emulator**
   ```bash
   ./gradlew installDebug
   ```

   Or use the Android Studio "Run" button (Shift+F10)

### Build Variants
- **Debug**: Development build with debugging enabled
- **Release**: Production build (requires signing configuration)

## Using the App

### First Launch
1. The app displays a welcome dialog offering a guided tour
2. Choose "Yes" to start the 21-step walkthrough
3. Or choose "Not now" to explore independently
4. Select "Don't show again" to skip future prompts

### Creating Posts
1. Tap the purple "+" floating button (bottom-right)
2. Enter a title and content
3. Tap "Post" to create
4. Your post appears at the top of the feed

### Walkthrough Tour
- Tap the purple info button (bottom-left) anytime to restart the tour
- Navigate with "Next" and "Back" buttons
- Exit anytime with the "Exit" button
- Progress is saved - completed tours won't auto-prompt again

### Menu Features
Access the menu (three dots) to explore:
- **Ansybl Feed**: Information about the feed endpoint
- **API Endpoints**: Available API operations
- **Protocol Bridges**: RSS, JSON Feed, and ActivityPub conversion
- **About**: App version and information

## Walkthrough Steps

The interactive tour covers these 21 topics:

1. Welcome introduction
2. Main feed display
3. Creating posts
4. Cryptographic signing
5. Social interactions (likes, shares, replies)
6. Tags and discovery
7. Ansybl feed endpoint
8. Content validation API
9. Parser and signature verification
10. Comments system
11. Interaction tracking
12. Media attachment support
13. Protocol bridges overview
14. RSS 2.0 bridge
15. JSON Feed bridge
16. ActivityPub federation
17. API endpoints
18. Rich content formats
19. Security features
20. Mobile-first design
21. Learning resources

## Integration with Ansybl Ecosystem

This Android app demonstrates the same concepts as the web-based example:
- **Web Example**: `/example-website` - Node.js/Express implementation
- **PHP Reader**: `/parsers/php_web_reader` - PHP-based content reader
- **React Reader**: `/parsers/reactjs` - React-based reader
- **Browser Extension**: `/browser-extension` - Browser integration

All implementations follow the same Ansybl specification and can interoperate.

## Ansybl Protocol Features Demonstrated

### Content Integrity
- Ed25519 cryptographic signatures on all posts
- JSON schema validation
- Content canonicalization for signing

### Social Features
- Likes, shares, and replies with metadata
- Threaded comments
- Interaction tracking with timestamps

### Media Handling
- Image, video, and audio support
- Metadata extraction
- Checksum verification

### Protocol Bridges
- RSS 2.0 conversion for legacy readers
- JSON Feed export for modern apps
- ActivityPub federation for decentralized social networks

## Development Roadmap

Future enhancements:
- [ ] Actual Ed25519 signature generation/verification
- [ ] Network API integration with Ansybl servers
- [ ] Media upload and preview
- [ ] Advanced post editor (Markdown support)
- [ ] Offline mode with local caching
- [ ] Push notifications for interactions
- [ ] Multi-account support
- [ ] Dark theme
- [ ] Accessibility improvements
- [ ] Widget for home screen

## Testing

### Manual Testing
1. Launch the app
2. Complete the walkthrough
3. Create several posts
4. Test menu items
5. Verify UI responsiveness

### Unit Testing (Future)
```bash
./gradlew test
```

### UI Testing (Future)
```bash
./gradlew connectedAndroidTest
```

## Troubleshooting

### Build Errors
- **Gradle sync failed**: Ensure you have JDK 17+ and Android SDK 34
- **Dependency resolution**: Check your internet connection and Maven Central access
- **Kotlin version**: Update Android Studio to the latest version

### Runtime Issues
- **App crashes on launch**: Check logcat for errors (`adb logcat`)
- **Walkthrough not showing**: Clear app data and relaunch
- **Layout issues**: Test on different screen sizes/orientations

## Contributing

Contributions are welcome! Please:
1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Test thoroughly
5. Submit a pull request

## License

This project is part of the Ansybl ecosystem. Check the main repository for license information.

## Learn More

- **Ansybl Specification**: See `/schema` directory
- **Web Example**: `/example-website` for the Node.js implementation
- **Documentation**: `/docs` for deployment guides
- **Main Website**: Visit ansybl.org for comprehensive documentation

## Support

For issues, questions, or feature requests:
- Open an issue on GitHub
- Check existing documentation in `/docs`
- Review the Ansybl specification

---

**Built with ❤️ for the decentralized web**
