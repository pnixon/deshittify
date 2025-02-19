# Ansybl

## Project Title: ansybl 

### 1 Introduction

1-1 Project Overview  
A decentralized spec for sharing media. Be it text, image, video, or audio. 

1-2 Motivation  
Social network algorithms make people sadder, but freedom makes people happy.

1-3 Stakeholders  
Pete and Matt - lead designers

### 2 Project Scope

2-1 Features  
A simple file format for sharing and reading media.

This file format can be understood similarly to RSS where self-hosted files provide either direct access (via short text elements) or links to access (like video/audio/image) posts.

This technology can be used to replace modern social networks, RSS feeds for podcasts, Art/work galleries, blog back-ends, and many more use cases.

2-2 Non-Features  
Creating actual servers/clients to read/serve the content

2-3 Use Cases  
Do you want to share something with the internet? Then this is for you.

### 3 Requirements

3-1 Functional Requirements
3-1-1 File format
Options are Json, yaml, or some proprietary file format.

Base required fields for each type of media will be different but all items need a guid.
3-1-2 Search
We can handle this in a few ways
Webring style
Web crawler style
3-1-3 Discoverability
Items should have a list of tags used to enhance discoverability.

Tags work on an inverse squares method where the first tag is exponentially more important than the next, and so on.

3-2 Non-Functional Requirements
Does not require proprietary clients but allows people to create and require them for their own stuff.

3-3 Technical Requirements**


### 4 Architecture and Design

4-1 System Architecture
None. that’s the beauty

4-2 Component Design
4-2-1 client
Everyone who wants to use this protocol
4-2-2 server
everyone can host their own server node
4-3 Data Model
Outline the data structures and database schema.

4-4 APIs and Interfaces
Detail the APIs and interfaces the software will provide.

### 5 Development Plan

5-1 Development Methodology
Kanban

5-2 Milestones and Timeline
Provide a high-level timeline with major milestones.

5-3 Versioning and Release Strategy
Explain the versioning scheme and release process.

5-4 Code Review and Quality Assurance
Outline the processes for code review, testing, and quality assurance.

### 6 Contribution Guidelines

6-1 How to Contribute
Provide guidelines for contributing to the project.

6-2 Code of Conduct
Include a code of conduct for contributors.

6-3 Issue Reporting and Feature Requests
Explain how to report issues and request features.

### 7 Documentation

7-1 User Documentation
Describe the user documentation that will be provided.

7-2 Developer Documentation
Outline the documentation for developers, including setup, contribution, and API documentation.

### 8 License

8-1 Licensing Information
Use MIT open source license for spec and all of our developed code, clients, servers. Proprietary code may be developed internally for some parts of the product to bring income to the project.

### 9 References

9-1 Related Projects
List any related projects and how they influence or integrate with this project.

9-2 Resources
Include any additional resources, such as research papers or technical articles.
Activity Streams 2.0: https://www.w3.org/TR/activitystreams-core/
