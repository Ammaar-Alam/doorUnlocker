//
//  Open_Door.swift
//  Open Door
//
//  Created by Ammaar Alam on 12/8/24.
//

import AppIntents

struct Open_Door: AppIntent {
    static var title: LocalizedStringResource { "Open Door" }
    
    func perform() async throws -> some IntentResult {
        return .result()
    }
}
