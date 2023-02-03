import m, { Children } from "mithril"
import { lang } from "../misc/LanguageViewModel"
import type { EntityUpdateData } from "../api/main/EventController"
import type { UpdatableSettingsViewer } from "./SettingsView"
import { TextField } from "../gui/base/TextField.js"
import { IconButton } from "../gui/base/IconButton.js"
import { ButtonSize } from "../gui/base/ButtonSize.js"
import { Icons } from "../gui/base/icons/Icons.js"
import { getReferralLink, shareReferralLink } from "./ReferralViewModel.js"
import { isApp } from "../api/common/Env.js"
import { BootIcons } from "../gui/base/icons/BootIcons.js"

export class ReferralSettingsViewer implements UpdatableSettingsViewer {
	view(): Children {
		return m(".fill-absolute.scroll.plr-l.pb-xl", [
			m(".h4.mt-l", lang.get("referralSettings_label")),
			m(TextField, {
				disabled: true,
				label: "referralLink_label",
				value: getReferralLink(),
				injectionsRight: this.renderShareButton,
			}),
		])
	}

	entityEventsReceived(updates: ReadonlyArray<EntityUpdateData>): Promise<unknown> {
		// no need to listen for updates as the userId will not change
		return Promise.resolve(undefined)
	}

	private renderShareButton() {
		if (isApp()) {
			return m(IconButton, {
				title: "share_action",
				click: shareReferralLink,
				icon: BootIcons.Share,
				size: ButtonSize.Compact,
			})
		} else {
			return m(IconButton, {
				title: "copy_action",
				click: shareReferralLink,
				icon: Icons.Clipboard,
				size: ButtonSize.Compact,
			})
		}
	}
}
