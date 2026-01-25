import time
from playwright.sync_api import sync_playwright

def verify_frontend():
    with sync_playwright() as p:
        browser = p.chromium.launch(headless=True)
        context = browser.new_context(viewport={"width": 1280, "height": 800})
        page = context.new_page()

        print("Navigating to Signup...")
        page.goto("http://localhost:3000/signup")

        email = f"user_{int(time.time())}@example.com"
        print(f"Signing up with {email}")

        page.fill("input[name='name']", "Test User")
        page.fill("input[name='email']", email)
        page.fill("input[name='password']", "password123")
        page.click("button[type='submit']")

        print("Waiting for dashboard...")
        try:
            page.wait_for_url("**/dashboard", timeout=10000)
        except:
            if "login" in page.url:
                print("Redirected to login, logging in...")
                page.fill("input[name='email']", email)
                page.fill("input[name='password']", "password123")
                page.click("button[type='submit']")
                page.wait_for_url("**/dashboard", timeout=10000)

        print("Logged in!")

        # 2. Verify Story Page
        print("Navigating to Story Page...")
        response = page.goto("http://localhost:3000/dashboard/story")
        print(f"Status: {response.status}")

        # DEBUG: Take screenshot immediately to see what's wrong
        page.screenshot(path="/home/jules/verification/debug_story.png")

        try:
            page.wait_for_selector("text=AI Story Review", timeout=10000)
            page.wait_for_selector("text=The Story")
            page.wait_for_selector("text=Question 1")
            page.screenshot(path="/home/jules/verification/story_page.png")
            print("Story Page OK")
        except Exception as e:
            print(f"Story Page Failed: {e}")
            # print(page.content())

        # 3. Verify Conversation Page
        print("Navigating to Conversation Page...")
        response = page.goto("http://localhost:3000/dashboard/conversation")
        print(f"Status: {response.status}")

        page.screenshot(path="/home/jules/verification/debug_conversation.png")

        try:
            page.wait_for_selector("text=AI Conversation Tutor", timeout=10000)
            page.screenshot(path="/home/jules/verification/conversation_page.png")
            print("Conversation Page OK")
        except Exception as e:
            print(f"Conversation Page Failed: {e}")

        browser.close()

if __name__ == "__main__":
    verify_frontend()
