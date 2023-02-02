import m, { Children } from "mithril"
import { lang } from "../misc/LanguageViewModel"
import type { EntityUpdateData } from "../api/main/EventController"
import type { UpdatableSettingsViewer } from "./SettingsView"
import { TextField } from "../gui/base/TextField.js"
import { IconButton } from "../gui/base/IconButton.js"
import { ButtonSize } from "../gui/base/ButtonSize.js"
import { BootIcons } from "../gui/base/icons/BootIcons.js"
import { isApp } from "../api/common/Env.js"
import { copyToClipboard } from "../misc/ClipboardUtils.js"
import { locator } from "../api/main/MainLocator.js"
import { getReferralLink } from "../mail/editor/MailEditor.js"

export class ReferralSettingsViewer implements UpdatableSettingsViewer {
	view(): Children {
		return m(".fill-absolute.scroll.plr-l.pb-xl", [
			m(".h4.mt-l", lang.get("referralSettings_label")),
			m(TextField, {
				disabled: true,
				label: "referralLink_label",
				value: getReferralLink(),
				injectionsRight: () =>
					m(IconButton, {
						title: "share_action",
						click: () => this.shareReferralLinkAction(),
						icon: BootIcons.Share,
						size: ButtonSize.Compact,
					}),
			}),
		])
	}

	private shareReferralLinkAction(): Promise<any> {
		const shareMessage = lang.get("referralLinkShare_msg", {
			"{referralLink}": getReferralLink(),
		})
		// open native share dialog on mobile
		if (isApp()) {
			return locator.systemFacade.shareText(shareMessage, lang.get("referralSettings_label"))
		} else {
			// (mobile) browser or desktop client
			// copy to the clip board
			return copyToClipboard(shareMessage) // TODO should we indicate to the user that we copied the message to the clipboard
		}
	}

	entityEventsReceived(updates: ReadonlyArray<EntityUpdateData>): Promise<unknown> {
		// no need to listen for updates as the userId will not change
		return Promise.resolve(undefined)
	}
}
