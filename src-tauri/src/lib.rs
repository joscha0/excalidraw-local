use git2::{Repository, Signature };
use std::path::Path;
use tauri::{AppHandle, Manager};

#[tauri::command]
fn init_git_repo(app_handle: AppHandle) -> Result<String, String> {
    let app_data = app_handle.path().app_data_dir().map_err(|e| e.to_string())?;
    let repo_path = app_data.join("excalidraw-local");
    
    if !repo_path.exists() {
        return Err("Directory does not exist".to_string());
    }

    // Check if git repo already exists
    if repo_path.join(".git").exists() {
        return Ok("Git repository already initialized".to_string());
    }

    // Initialize new repository
    match Repository::init(repo_path) {
        Ok(_) => Ok("Git repository initialized successfully".to_string()),
        Err(e) => Err(format!("Failed to initialize repository: {}", e)),
    }
}

#[tauri::command]
fn commit_changes(app_handle: AppHandle, file_path: String, message: String) -> Result<String, String> {
    let app_data = app_handle.path().app_data_dir().map_err(|e| e.to_string())?;
    let repo_path = app_data.join("excalidraw-local");
    
    // Open the repository
    let repo = Repository::open(repo_path.clone()).map_err(|e| format!("Failed to open repository: {}", e))?;
    
    // Create the signature for the commit
    let signature = Signature::now("Excalidraw Local", "excalidraw@local.app")
        .map_err(|e| format!("Failed to create signature: {}", e))?;
    
    // Add file to index
    let mut index = repo.index().map_err(|e| format!("Failed to get index: {}", e))?;
    
    // Calculate the path relative to the repository root
    let full_path = Path::new(&file_path);
    let relative_path = full_path.strip_prefix("excalidraw-local/").unwrap_or(full_path);
    
    index.add_path(relative_path).map_err(|e| format!("Failed to add file: {}", e))?;
    index.write().map_err(|e| format!("Failed to write index: {}", e))?;
    
    // Create tree from index
    let tree_id = index.write_tree().map_err(|e| format!("Failed to write tree: {}", e))?;
    let tree = repo.find_tree(tree_id).map_err(|e| format!("Failed to find tree: {}", e))?;
    
    let parent_commit = match repo.head() {
        Ok(head) => head.peel_to_commit().map_err(|e| format!("Failed to peel to commit: {}", e))?,
        Err(_) => {
            // No parent commit, create commit with empty parents
            return repo.commit(
                Some("HEAD"),
                &signature,
                &signature,
                &message,
                &tree,
                &[] // empty parents
            )
            .map_err(|e| format!("Failed to commit: {}", e))
            .map(|_| "Changes committed successfully".to_string());
        }
    };
    
    repo.commit(
        Some("HEAD"),
        &signature,
        &signature,
        &message,
        &tree,
        &[&parent_commit] // directly use parent_commit
    )
    .map_err(|e| format!("Failed to commit: {}", e))
    .map(|_| "Changes committed successfully".to_string())
}

#[tauri::command]
fn get_file_history(app_handle: AppHandle, file_path: String) -> Result<Vec<HistoryEntry>, String> {
    let app_data = app_handle.path().app_data_dir().map_err(|e| e.to_string())?;
    let repo_path = app_data.join("excalidraw-local");
    
    let repo = Repository::open(repo_path).map_err(|e| format!("Failed to open repository: {}", e))?;
    let mut revwalk = repo.revwalk().map_err(|e| format!("Failed to create revwalk: {}", e))?;
    revwalk.push_head().map_err(|e| format!("Failed to push head: {}", e))?;
    
    let relative_path = Path::new(&file_path).file_name().ok_or("Invalid file path")?;
    let rel_path_str = relative_path.to_str().ok_or("Invalid path string")?;
    
    let mut history = Vec::new();
    
    for commit_id in revwalk {
        let commit_id = commit_id.map_err(|e| format!("Failed to get commit id: {}", e))?;
        let commit = repo.find_commit(commit_id).map_err(|e| format!("Failed to find commit: {}", e))?;
        
        // Check if this commit modified our file
        if let Ok(diff) = diff_for_commit(&repo, &commit, rel_path_str) {
            if diff {
                history.push(HistoryEntry {
                    commit_id: commit_id.to_string(),
                    message: commit.message().unwrap_or("").to_string(),
                    timestamp: commit.time().seconds(),
                    author: commit.author().name().unwrap_or("Unknown").to_string(),
                });
            }
        }
    }
    
    Ok(history)
}

// Helper function to check if a commit modified a specific file
fn diff_for_commit(repo: &Repository, commit: &git2::Commit, path: &str) -> Result<bool, git2::Error> {
    let parent = if commit.parents().len() > 0 {
        Some(commit.parent(0)?)
    } else {
        None
    };
    
    let parent_tree = match parent {
        Some(ref p) => Some(p.tree()?),
        None => None,
    };
    
    let commit_tree = commit.tree()?;
    
    let diff = match parent_tree {
        Some(parent_tree) => repo.diff_tree_to_tree(Some(&parent_tree), Some(&commit_tree), None)?,
        None => repo.diff_tree_to_tree(None, Some(&commit_tree), None)?,
    };
    
    let mut found = false;
    diff.foreach(
        &mut |delta, _| {
            if let Some(file_path) = delta.new_file().path() {
                if file_path.to_str().unwrap_or("") == path {
                    found = true;
                }
            }
            true
        },
        None,
        None,
        None,
    )?;
    
    Ok(found)
}

#[derive(serde::Serialize)]
struct HistoryEntry {
    commit_id: String,
    message: String,
    timestamp: i64,
    author: String,
}

#[tauri::command]
fn restore_version(app_handle: AppHandle, file_path: String, commit_id: String) -> Result<String, String> {
    let app_data = app_handle.path().app_data_dir().map_err(|e| e.to_string())?;
    let repo_path = app_data.join("excalidraw-local");
    
    let repo = Repository::open(repo_path).map_err(|e| format!("Failed to open repository: {}", e))?;
    let commit_oid = git2::Oid::from_str(&commit_id).map_err(|e| format!("Invalid commit ID: {}", e))?;
    let commit = repo.find_commit(commit_oid).map_err(|e| format!("Failed to find commit: {}", e))?;
    
    let relative_path = Path::new(&file_path).file_name().ok_or("Invalid file path")?;
    let tree = commit.tree().map_err(|e| format!("Failed to get tree: {}", e))?;
    
    let entry = tree.get_path(Path::new(relative_path)).map_err(|e| format!("File not found in commit: {}", e))?;
    let blob = repo.find_blob(entry.id()).map_err(|e| format!("Failed to find blob: {}", e))?;
    
    let content = String::from_utf8_lossy(blob.content()).to_string();
    
    // Write the content back to the file
    std::fs::write(
        app_data.join(&file_path),
        content
    ).map_err(|e| format!("Failed to write file: {}", e))?;
    
    Ok("Version restored successfully".to_string())
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_fs::init())
        .plugin(tauri_plugin_opener::init())
        .invoke_handler(tauri::generate_handler![
            init_git_repo,
            commit_changes,
            get_file_history,
            restore_version
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
